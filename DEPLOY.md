# Deploying Deckhouse

This guide covers running Deckhouse as a Docker container on a Linux server,
reached over HTTPS through a Caddy reverse proxy. That is the recommended
setup — Deckhouse itself controls Docker Compose, so running it as a container
alongside other services is the natural fit.

For a bare-metal / systemd install, see the note at the bottom.

---

## 1. Prerequisites

On the server:

- Linux with Docker Engine ≥ 24 and the `docker compose` v2 plugin
- A DNS record pointing to the server (e.g. `deckhouse.example.com`)
- Caddy (or another reverse proxy that terminates TLS)
- Port 80 and 443 open to the internet (for Caddy / Let's Encrypt)

Verify Docker works:

```bash
docker version
docker compose version
```

## 2. Create host directories

Deckhouse needs two persistent directories on the host. The **stacks path must
match inside and outside the container** — see the comment in
`deploy/compose.yaml` for why.

```bash
sudo mkdir -p /opt/deckhouse/data /opt/deckhouse/stacks
```

## 3. Get the source

```bash
cd /opt
sudo git clone https://github.com/<you>/deckhouse.git deckhouse-src
cd deckhouse-src
```

You only need the source tree long enough to build the image; you can keep it
around for easy upgrades.

## 4. Build and start the container

```bash
cd deploy
sudo docker compose up -d --build
```

The container binds to `127.0.0.1:5001` — **not reachable from the internet
yet**, which is intentional. Next step sets up TLS in front of it.

Check it's running:

```bash
sudo docker compose ps
sudo docker compose logs -f deckhouse
```

You should see:

```
Deckhouse listening on http://0.0.0.0:5001
Stacks directory: /opt/deckhouse/stacks
Need setup: true
```

## 5. Configure Caddy (HTTPS + WebSocket)

```bash
sudo cp deploy/Caddyfile.example /etc/caddy/Caddyfile
sudo sed -i 's/deckhouse.example.com/your.domain.com/' /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Caddy will obtain a Let's Encrypt cert on first request. Socket.IO WebSocket
upgrades work out of the box — no special config needed.

## 6. Create the first admin

Visit `https://your.domain.com` in a browser. You'll land on `/setup`. Enter a
username and password — **this first account is automatically the admin**.

After setup:

- Use Settings → Users to add additional accounts. Non-admin users can view /
  control stacks but can't manage users, change global settings, or open the
  host console.
- Use Settings → Security to rotate your password.

## 7. Upgrade procedure

```bash
cd /opt/deckhouse-src
sudo git pull
cd deploy
sudo docker compose up -d --build
```

`docker compose` rebuilds the image, recreates the container, and keeps the
volumes (`/opt/deckhouse/data` and `/opt/deckhouse/stacks`) intact. Logged-in
users may need to sign in again — JWTs are rotated across restarts only when
the JWT secret file is deleted.

---

## Security checklist

Before opening access to anyone else, verify:

- [ ] Caddy/reverse proxy is serving HTTPS and the cert is valid
- [ ] Deckhouse port is bound to `127.0.0.1` (see `deploy/compose.yaml`), not
      `0.0.0.0` — otherwise it's reachable on raw HTTP
- [ ] `DECKHOUSE_ENABLE_CONSOLE` is **not** set (host shell = root on the host)
- [ ] Only one admin account exists (don't leave a test admin around)
- [ ] Server firewall blocks 5001 from the outside (`ufw`, cloud security group…)
- [ ] `/opt/deckhouse/data/jwt-secret.txt` exists and is unique to this install
      (never commit it anywhere)

---

## Common issues

### `docker: command not found` in container logs

The image does not include the Docker CLI. Rebuild with `--no-cache`:

```bash
sudo docker compose build --no-cache
sudo docker compose up -d
```

### Stacks created in UI don't start, error references a path that doesn't exist

Your host bind-mount path and `DECKHOUSE_STACKS_DIR` don't match. Both must be
exactly `/opt/deckhouse/stacks` (or both must be whatever value you chose in
`deploy/compose.yaml`).

### `EACCES: permission denied, open '/var/run/docker.sock'`

The Deckhouse container needs access to the Docker socket. On SELinux /
hardened hosts add `:z` to the mount:

```yaml
- /var/run/docker.sock:/var/run/docker.sock:z
```

### Uploads fail with "File too large"

The Socket.IO buffer is 50 MB. Anything larger must be placed on the server by
other means (`scp`, `rsync`) — Deckhouse is not a file transfer tool.

### Terminal tab stays blank

The target container must have `sh` available. Distroless or scratch-based
images don't ship a shell; use `docker exec` from the host instead for those.

### Logs show `Admin privilege required` after upgrading from an older build

Your user account needs the new `isAdmin` flag. On load, the server promotes
the lowest-id user to admin automatically — so if you're the original setup
user you're fine. If you were added later, ask the original admin (or delete
`users.json` and run through `/setup` again; this wipes all user accounts).

---

## Alternative: bare-metal install

If you'd rather not run Deckhouse in a container:

```bash
git clone https://github.com/<you>/deckhouse.git
cd deckhouse
npm install
npm run build:frontend

sudo tee /etc/systemd/system/deckhouse.service <<'EOF'
[Unit]
Description=Deckhouse
After=docker.service
Requires=docker.service

[Service]
Type=simple
WorkingDirectory=/opt/deckhouse
Environment=DECKHOUSE_HOSTNAME=127.0.0.1
Environment=DECKHOUSE_STACKS_DIR=/opt/deckhouse/stacks
Environment=DECKHOUSE_DATA_DIR=/opt/deckhouse/data
ExecStart=/usr/bin/npm start
Restart=always
User=root

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable --now deckhouse
```

Use the same Caddy config from step 5. The rest (first admin, security
checklist, upgrade) is the same — except upgrade is `git pull && npm install &&
npm run build:frontend && systemctl restart deckhouse`.
