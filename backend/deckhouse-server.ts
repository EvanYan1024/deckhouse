import express from "express";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import type { Socket } from "socket.io";
import type { DeckouseSocket } from "./util-server";
import { AgentSocket } from "../common/agent-socket";
import { Stack } from "./stack";

// Socket handlers
import { MainSocketHandler } from "./socket-handlers/main-socket-handler";
import { AgentProxySocketHandler } from "./socket-handlers/agent-proxy-socket-handler";

// Agent socket handlers
import { DockerSocketHandler } from "./agent-socket-handlers/docker-socket-handler";
import { FileSocketHandler } from "./agent-socket-handlers/file-socket-handler";
import { TerminalSocketHandler } from "./agent-socket-handlers/terminal-socket-handler";
import { AgentManager } from "./agent-manager";

export interface UserRecord {
    id: number;
    username: string;
    password: string;
    isAdmin: boolean;
}

export interface ServerSettings {
    primaryDomain: string;
}

const defaultSettings: ServerSettings = {
    primaryDomain: "",
};

export class DeckouseServer {
    app: express.Application;
    httpServer: ReturnType<typeof createServer>;
    io: SocketIOServer;

    port: number;
    hostname: string;
    stacksDir: string;
    dataDir: string;
    jwtSecret: string = "";
    needSetup: boolean = true;

    // In-memory user store (will be replaced with DB later)
    users: Map<string, UserRecord> = new Map();

    // Server settings
    settings: ServerSettings = { ...defaultSettings };

    // Shared across connections — guards concurrent first-user setup
    setupInProgress: boolean = false;

    constructor() {
        this.port = parseInt(process.env.DECKHOUSE_PORT ?? "5001", 10);
        this.hostname = process.env.DECKHOUSE_HOSTNAME ?? "0.0.0.0";
        const rootDir = path.resolve(__dirname, "..");
        this.stacksDir = path.resolve(process.env.DECKHOUSE_STACKS_DIR ?? path.join(rootDir, "stacks"));
        this.dataDir = path.resolve(process.env.DECKHOUSE_DATA_DIR ?? path.join(rootDir, "data"));

        this.app = express();
        this.httpServer = createServer(this.app);
        this.io = new SocketIOServer(this.httpServer, {
            transports: ["websocket", "polling"],
            maxHttpBufferSize: 50 * 1024 * 1024, // 50MB for file uploads
        });
    }

    async start() {
        // Ensure directories exist
        fs.mkdirSync(this.dataDir, { recursive: true });
        fs.mkdirSync(this.stacksDir, { recursive: true });

        // Resolve symlinks so PathValidator.allowedRoots matches fs.realpath()
        // output of any child path (otherwise every file op fails when the
        // admin sets DECKHOUSE_STACKS_DIR to a symlink)
        this.dataDir = fs.realpathSync(this.dataDir);
        this.stacksDir = fs.realpathSync(this.stacksDir);

        // Load or generate JWT secret
        const secretPath = path.join(this.dataDir, "jwt-secret.txt");
        if (fs.existsSync(secretPath)) {
            this.jwtSecret = fs.readFileSync(secretPath, "utf-8").trim();
        } else {
            this.jwtSecret = crypto.randomBytes(32).toString("hex");
            fs.writeFileSync(secretPath, this.jwtSecret, "utf-8");
        }

        // Load users from file (simple JSON persistence)
        const usersPath = path.join(this.dataDir, "users.json");
        if (fs.existsSync(usersPath)) {
            const data = JSON.parse(fs.readFileSync(usersPath, "utf-8"));
            if (Array.isArray(data)) {
                for (const user of data) {
                    if (user && typeof user.username === "string" && typeof user.password === "string") {
                        // Backward-compat: users.json written before the
                        // isAdmin field existed has no role. Default to false
                        // and promote the lowest-id user below.
                        this.users.set(user.username, {
                            id: user.id,
                            username: user.username,
                            password: user.password,
                            isAdmin: user.isAdmin === true,
                        });
                    }
                }
            }
            // If no user is an admin (legacy data), promote the lowest-id user.
            // Without this, nobody could call admin-only endpoints after upgrade.
            if (this.users.size > 0 && ![...this.users.values()].some((u) => u.isAdmin)) {
                const first = [...this.users.values()].sort((a, b) => a.id - b.id)[0];
                first.isAdmin = true;
                this.saveUsers();
            }
            this.needSetup = this.users.size === 0;
        }

        // Load settings. If the file is corrupt we crash — silently falling
        // back to defaults would hide the problem and let a later saveSettings()
        // overwrite whatever the user had.
        const settingsPath = path.join(this.dataDir, "settings.json");
        if (fs.existsSync(settingsPath)) {
            const data = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
            this.settings = { ...defaultSettings, ...data };
        }

        // Serve frontend static files in production
        const frontendDistPath = path.join(__dirname, "..", "frontend", "dist");
        if (fs.existsSync(frontendDistPath)) {
            this.app.use(express.static(frontendDistPath));
            this.app.get("/{*path}", (_req, res) => {
                res.sendFile(path.join(frontendDistPath, "index.html"));
            });
        }

        // Socket.IO connection handling
        this.io.on("connection", (rawSocket: Socket) => {
            const socket = rawSocket as DeckouseSocket;
            socket.userID = 0;
            socket.endpoint = "";

            console.log(`Client connected: ${socket.id}`);

            // Fresh handler instances per connection — state like terminal/log
            // maps must NOT leak across sockets
            new MainSocketHandler().create(socket, this);

            // Create agent socket (local event emitter)
            const agentSocket = new AgentSocket();

            // Register agent socket handlers
            new DockerSocketHandler().create(socket, this, agentSocket);
            new FileSocketHandler().create(socket, this, agentSocket);
            new TerminalSocketHandler().create(socket, this, agentSocket);

            // Agent manager (remote agents)
            const agentManager = new AgentManager(this, socket);

            // Agent proxy (routes "agent" events)
            new AgentProxySocketHandler().register(socket, this, agentSocket, agentManager);

            socket.on("disconnect", () => {
                agentManager.disconnectAll();
                console.log(`Client disconnected: ${socket.id}`);
            });
        });

        // Start listening
        this.httpServer.listen(this.port, this.hostname, () => {
            console.log(`Deckhouse listening on http://${this.hostname}:${this.port}`);
            console.log(`Stacks directory: ${this.stacksDir}`);
            console.log(`Need setup: ${this.needSetup}`);
        });
    }

    /**
     * Called after successful login. Sets userID and sends initial data.
     */
    afterLogin(socket: DeckouseSocket, userID: number) {
        socket.userID = userID;
        this.sendStackList(socket);
    }

    /**
     * Send the current stack list to a specific socket.
     */
    async sendStackList(socket: DeckouseSocket) {
        try {
            const list = await Stack.getStackList(this);
            socket.emit("stackList", list);
        } catch (e) {
            console.error("Failed to send stack list:", e);
        }
    }

    /**
     * Persist settings to disk.
     */
    saveSettings() {
        const settingsPath = path.join(this.dataDir, "settings.json");
        fs.writeFileSync(settingsPath, JSON.stringify(this.settings, null, 2), "utf-8");
    }

    /**
     * Persist users to disk.
     */
    saveUsers() {
        const usersPath = path.join(this.dataDir, "users.json");
        const data = Array.from(this.users.values());
        fs.writeFileSync(usersPath, JSON.stringify(data, null, 2), "utf-8");
    }
}
