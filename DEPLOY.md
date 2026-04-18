# 部署 Deckhouse

本指南说明如何在 Linux 服务器上以 Docker 容器形式运行 Deckhouse,并通过
Caddy 反向代理以 HTTPS 对外提供服务。**推荐采用这种部署方式** —— 因为
Deckhouse 本身管理 Docker Compose,把它作为容器与其他服务一起运行是最
自然的选择。

如需裸机 / systemd 安装方式,请看文末。

---

## 1. 前置条件

服务器上需要准备:

- Linux 系统,Docker Engine ≥ 24,已安装 `docker compose` v2 插件
- 一个指向该服务器的 DNS 记录(例如 `deckhouse.example.com`)
- Caddy(或其他支持 TLS 终止的反向代理)
- 80 和 443 端口对公网开放(供 Caddy / Let's Encrypt 使用)

验证 Docker 正常工作:

```bash
docker version
docker compose version
```

## 2. 创建宿主机目录

Deckhouse 需要在宿主机上持有两个持久化目录。**stacks 目录的路径在容器内
和容器外必须完全一致** —— 原因见 `deploy/compose.yaml` 中的注释。

```bash
sudo mkdir -p /opt/deckhouse/data /opt/deckhouse/stacks
```

## 3. 拉取源代码

```bash
cd /opt
sudo git clone https://github.com/<you>/deckhouse.git deckhouse-src
cd deckhouse-src
```

源代码树只在构建镜像时用到;保留它方便后续升级。

## 4. 构建并启动容器

```bash
cd deploy
sudo docker compose up -d --build
```

容器绑定到 `127.0.0.1:5001`,**此时从公网访问不到** —— 这是有意为之,
下一步会在它前面加一层 TLS。

检查是否在运行:

```bash
sudo docker compose ps
sudo docker compose logs -f deckhouse
```

你应该会看到:

```
Deckhouse listening on http://0.0.0.0:5001
Stacks directory: /opt/deckhouse/stacks
Need setup: true
```

## 5. 配置 Caddy(HTTPS + WebSocket)

```bash
sudo cp deploy/Caddyfile.example /etc/caddy/Caddyfile
sudo sed -i 's/deckhouse.example.com/your.domain.com/' /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

首次请求时,Caddy 会自动向 Let's Encrypt 申请证书。Socket.IO 的
WebSocket 升级开箱即用,不需要任何额外配置。

## 6. 创建第一个管理员

在浏览器打开 `https://your.domain.com`,会进入 `/setup` 页面。填写用户
名和密码 —— **第一个创建的账户自动成为管理员**。

设置完成后:

- 在 Settings → Users 添加更多账号。非管理员用户可以查看 / 操作 stacks,
  但不能管理用户、修改全局设置,或打开宿主机 Console。
- 在 Settings → Security 修改密码。

## 7. 升级流程

```bash
cd /opt/deckhouse-src
sudo git pull
cd deploy
sudo docker compose up -d --build
```

`docker compose` 会重建镜像、重建容器,两个卷
(`/opt/deckhouse/data` 和 `/opt/deckhouse/stacks`)的数据不受影响。
已登录的用户可能需要重新登录 —— JWT 密钥只在
`jwt-secret.txt` 文件被删除时才会轮换,重启本身不会让 token 失效。

---

## 安全检查清单

在把访问权限开放给其他人之前,逐项确认:

- [ ] Caddy / 反向代理已提供 HTTPS,证书有效
- [ ] Deckhouse 端口绑定在 `127.0.0.1`(见 `deploy/compose.yaml`),
      而不是 `0.0.0.0` —— 否则原始 HTTP 直接就能访问
- [ ] **没有**设置 `DECKHOUSE_ENABLE_CONSOLE`(打开后宿主 shell 等于 root)
- [ ] 只保留一个管理员账号(测试期的管理员账号要及时删掉)
- [ ] 服务器防火墙对外屏蔽 5001(`ufw`、云平台安全组等)
- [ ] `/opt/deckhouse/data/jwt-secret.txt` 存在,且只属于当前这个实例
      (**绝不能**提交到任何仓库)

---

## 常见问题

### 容器日志里出现 `docker: command not found`

镜像里没有 Docker CLI。用 `--no-cache` 重新构建:

```bash
sudo docker compose build --no-cache
sudo docker compose up -d
```

### 在 UI 里创建的 stack 启不起来,错误里提到一个不存在的路径

宿主机 bind-mount 的路径和 `DECKHOUSE_STACKS_DIR` 不一致。两者必须都是
`/opt/deckhouse/stacks`(或你在 `deploy/compose.yaml` 里改成的值),一字
不差。

### `EACCES: permission denied, open '/var/run/docker.sock'`

Deckhouse 容器需要访问 Docker socket。在 SELinux / 强化过的宿主上,给
挂载加 `:z` 选项:

```yaml
- /var/run/docker.sock:/var/run/docker.sock:z
```

### 上传文件时报 "File too large"

Socket.IO 的缓冲区上限是 50 MB。超过这个大小只能用别的方式把文件放到
服务器上(`scp`、`rsync` 等)—— Deckhouse 不是文件传输工具。

### Terminal 标签页一片空白

目标容器里必须有 `sh` 可用。基于 distroless 或 scratch 的镜像不自带 shell;
遇到这种镜像,从宿主机上用 `docker exec` 代替。

### 从旧版本升级后,日志里出现 `Admin privilege required`

你的账号需要新引入的 `isAdmin` 标志。加载时,服务器会自动把 id 最小的
用户提升为管理员 —— 如果你是最早完成 setup 的用户,不受影响。如果你是
后来被加进去的,请让原始管理员操作(或者删掉 `users.json` 重新走
`/setup`,注意这会清空所有用户账号)。

---

## 备选方案:裸机安装

如果不想把 Deckhouse 放进容器:

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

Caddy 配置与第 5 步相同。其余内容(首个管理员、安全检查、升级)也和
容器方式完全一致 —— 区别只在升级步骤变成
`git pull && npm install && npm run build:frontend && systemctl restart deckhouse`。
