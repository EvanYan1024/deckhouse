import { io, type Socket as ClientSocket } from "socket.io-client";
import fs from "fs";
import path from "path";
import type { DeckouseServer } from "./deckhouse-server";
import type { DeckouseSocket } from "./util-server";

export interface AgentRecord {
    url: string;
    username: string;
    password: string;
    name: string;
    endpoint: string;
}

/**
 * Manages connections to remote Deckhouse agents.
 * One instance per browser socket connection.
 */
export class AgentManager {
    private agents: Map<string, AgentRecord> = new Map();
    private clients: Map<string, ClientSocket> = new Map();
    private loggedIn: Map<string, boolean> = new Map();
    private server: DeckouseServer;
    private socket: DeckouseSocket;

    constructor(server: DeckouseServer, socket: DeckouseSocket) {
        this.server = server;
        this.socket = socket;
        this.loadAgents();
    }

    // --- Persistence ---

    private get agentsPath(): string {
        return path.join(this.server.dataDir, "agents.json");
    }

    private loadAgents() {
        if (!fs.existsSync(this.agentsPath)) return;
        // Let JSON parse errors propagate — a corrupt agents.json shouldn't be
        // silently replaced by an empty list on the next save.
        const data = JSON.parse(fs.readFileSync(this.agentsPath, "utf-8"));
        if (Array.isArray(data)) {
            for (const agent of data) {
                if (agent?.endpoint) {
                    this.agents.set(agent.endpoint, agent);
                }
            }
        }
    }

    private saveAgents() {
        const data = [...this.agents.values()];
        fs.writeFileSync(this.agentsPath, JSON.stringify(data, null, 2), "utf-8");
    }

    // --- Agent CRUD ---

    getAgentList(): Record<string, { url: string; name: string; endpoint: string }> {
        const result: Record<string, { url: string; name: string; endpoint: string }> = {};
        for (const [ep, agent] of this.agents) {
            result[ep] = { url: agent.url, name: agent.name, endpoint: ep };
        }
        return result;
    }

    async addAgent(url: string, username: string, password: string, name: string): Promise<string> {
        const endpoint = new URL(url).host;
        if (this.agents.has(endpoint)) {
            throw new Error(`Agent "${endpoint}" already exists`);
        }

        // Test connection first
        await this.testConnection(url, username, password);

        const agent: AgentRecord = { url, username, password, name, endpoint };
        this.agents.set(endpoint, agent);
        this.saveAgents();

        this.connectAgent(agent);
        return endpoint;
    }

    removeAgent(endpoint: string) {
        this.disconnectAgent(endpoint);
        this.agents.delete(endpoint);
        this.saveAgents();
    }

    // --- Connection management ---

    connectAll() {
        for (const agent of this.agents.values()) {
            this.connectAgent(agent);
        }
    }

    disconnectAll() {
        for (const [ep] of this.clients) {
            this.disconnectAgent(ep);
        }
    }

    private connectAgent(agent: AgentRecord) {
        this.disconnectAgent(agent.endpoint);
        this.emitStatus(agent.endpoint, "connecting");

        const client = io(agent.url, {
            transports: ["websocket"],
            reconnection: true,
            reconnectionDelay: 3000,
        });

        this.clients.set(agent.endpoint, client);
        this.loggedIn.set(agent.endpoint, false);

        client.on("connect", () => {
            // Login to remote agent
            client.emit("login", { username: agent.username, password: agent.password },
                (res: { ok: boolean; token?: string }) => {
                    if (res.ok) {
                        this.loggedIn.set(agent.endpoint, true);
                        this.emitStatus(agent.endpoint, "online");
                    } else {
                        this.emitStatus(agent.endpoint, "offline");
                    }
                }
            );
        });

        // Forward remote stack list to browser
        client.on("stackList", (data: Record<string, unknown>) => {
            this.socket.emit("agentStackList", agent.endpoint, data);
        });

        client.on("disconnect", () => {
            this.loggedIn.set(agent.endpoint, false);
            this.emitStatus(agent.endpoint, "offline");
        });

        client.on("connect_error", () => {
            this.emitStatus(agent.endpoint, "offline");
        });
    }

    private disconnectAgent(endpoint: string) {
        const client = this.clients.get(endpoint);
        if (client) {
            client.removeAllListeners();
            client.disconnect();
            this.clients.delete(endpoint);
            this.loggedIn.delete(endpoint);
        }
    }

    // --- Event proxying ---

    emitToEndpoint(endpoint: string, eventName: string, ...args: unknown[]) {
        const client = this.clients.get(endpoint);
        if (!client?.connected || !this.loggedIn.get(endpoint)) {
            // Find callback (last arg if function)
            const callback = args[args.length - 1];
            if (typeof callback === "function") {
                callback({ ok: false, msg: `Agent "${endpoint}" is not connected` });
            }
            return;
        }
        // Forward via agent protocol on remote
        client.emit("agent", "", eventName, ...args);
    }

    // --- Helpers ---

    private emitStatus(endpoint: string, status: "online" | "offline" | "connecting") {
        this.socket.emit("agentStatus", endpoint, status);
    }

    private testConnection(url: string, username: string, password: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                client.disconnect();
                reject(new Error("Connection timed out"));
            }, 10000);

            const client = io(url, {
                transports: ["websocket"],
                reconnection: false,
            });

            client.on("connect", () => {
                client.emit("login", { username, password },
                    (res: { ok: boolean }) => {
                        clearTimeout(timeout);
                        client.disconnect();
                        if (res.ok) resolve();
                        else reject(new Error("Invalid credentials"));
                    }
                );
            });

            client.on("connect_error", (err) => {
                clearTimeout(timeout);
                client.disconnect();
                reject(new Error(`Connection failed: ${err.message}`));
            });
        });
    }
}
