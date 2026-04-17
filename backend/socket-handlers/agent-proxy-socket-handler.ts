import type { DeckouseServer } from "../deckhouse-server";
import { checkLogin, callbackError, callbackResult, type DeckouseSocket } from "../util-server";
import type { AgentSocket } from "../../common/agent-socket";
import type { AgentManager } from "../agent-manager";

// Not a SocketHandler subclass: it needs access to AgentSocket and AgentManager
// on top of the base (socket, server) pair. Forcing it into the SocketHandler
// shape required a dummy create() and a create2() — separate class avoids that.
export class AgentProxySocketHandler {
    register(
        socket: DeckouseSocket,
        _server: DeckouseServer,
        agentSocket: AgentSocket,
        agentManager: AgentManager,
    ) {
        // --- Route agent events ---
        socket.on("agent", async (
            endpoint: unknown,
            eventName: unknown,
            ...args: unknown[]
        ) => {
            try {
                checkLogin(socket);

                if (typeof eventName !== "string") {
                    return;
                }

                // Local: empty endpoint or matching current
                if (!endpoint || endpoint === "" || endpoint === socket.endpoint) {
                    agentSocket.call(eventName, ...args);
                } else {
                    // Remote endpoint — proxy through agent manager
                    agentManager.emitToEndpoint(String(endpoint), eventName, ...args);
                }
            } catch {
                // Not logged in — silently drop
            }
        });

        // --- Agent management ---
        socket.on("addAgent", async (data: unknown, callback: unknown) => {
            try {
                checkLogin(socket);
                if (typeof data !== "object" || data === null) {
                    throw new Error("Invalid data");
                }
                const { url, username, password, name } = data as Record<string, unknown>;
                if (typeof url !== "string" || typeof username !== "string" ||
                    typeof password !== "string" || typeof name !== "string") {
                    throw new Error("url, username, password, and name are required");
                }

                const endpoint = await agentManager.addAgent(url, username, password, name);
                socket.emit("agentList", agentManager.getAgentList());
                callbackResult({ ok: true, endpoint }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        socket.on("removeAgent", async (endpoint: unknown, callback: unknown) => {
            try {
                checkLogin(socket);
                if (typeof endpoint !== "string") throw new Error("endpoint must be a string");
                agentManager.removeAgent(endpoint);
                socket.emit("agentList", agentManager.getAgentList());
                callbackResult({ ok: true }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        socket.on("getAgentList", async (callback: unknown) => {
            try {
                checkLogin(socket);
                callbackResult({ ok: true, agentList: agentManager.getAgentList() }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        socket.on("connectAgents", async (callback: unknown) => {
            try {
                checkLogin(socket);
                agentManager.connectAll();
                callbackResult({ ok: true }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });
    }
}
