import { spawn, type ChildProcess } from "child_process";
import { AgentSocketHandler } from "../agent-socket-handler";
import type { DeckouseServer } from "../deckhouse-server";
import {
    callbackError,
    callbackResult,
    checkLogin,
    ValidationError,
    type DeckouseSocket,
} from "../util-server";
import { Stack } from "../stack";
import type { AgentSocket } from "../../common/agent-socket";

export class DockerSocketHandler extends AgentSocketHandler {
    /** Active log streaming processes, keyed by logId */
    private logProcesses: Map<string, ChildProcess> = new Map();

    create(socket: DeckouseSocket, server: DeckouseServer, agentSocket: AgentSocket) {

        // --- Deploy stack (save + up) ---
        agentSocket.on("deployStack", async (
            name: unknown, composeYAML: unknown, composeENV: unknown,
            isAdd: unknown, callback: unknown,
        ) => {
            try {
                checkLogin(socket);
                const stack = await this.saveStack(server, name, composeYAML, composeENV, isAdd);
                await stack.deploy((data) => socket.emit(`stackProgress:${stack.name}`, data));
                await server.sendStackList(socket);
                callbackResult({ ok: true, msg: "Deployed" }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // --- Save stack (no deploy) ---
        agentSocket.on("saveStack", async (
            name: unknown, composeYAML: unknown, composeENV: unknown,
            isAdd: unknown, callback: unknown,
        ) => {
            try {
                checkLogin(socket);
                await this.saveStack(server, name, composeYAML, composeENV, isAdd);
                await server.sendStackList(socket);
                callbackResult({ ok: true, msg: "Saved" }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // --- Delete stack ---
        agentSocket.on("deleteStack", async (name: unknown, callback: unknown) => {
            try {
                checkLogin(socket);
                if (typeof name !== "string") {
                    throw new ValidationError("Name must be a string");
                }
                const stack = await Stack.getStack(server, name);
                await stack.delete((data) => socket.emit(`stackProgress:${name}`, data));
                await server.sendStackList(socket);
                callbackResult({ ok: true, msg: "Deleted" }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // --- Get stack details ---
        agentSocket.on("getStack", async (name: unknown, callback: unknown) => {
            try {
                checkLogin(socket);
                if (typeof name !== "string") {
                    throw new ValidationError("Name must be a string");
                }
                const stack = await Stack.getStack(server, name);
                callbackResult({ ok: true, stack: stack.toJSON() }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // --- Start stack ---
        agentSocket.on("startStack", async (name: unknown, callback: unknown) => {
            try {
                checkLogin(socket);
                if (typeof name !== "string") {
                    throw new ValidationError("Name must be a string");
                }
                const stack = await Stack.getStack(server, name);
                await stack.start((data) => socket.emit(`stackProgress:${name}`, data));
                await server.sendStackList(socket);
                callbackResult({ ok: true, msg: "Started" }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // --- Stop stack ---
        agentSocket.on("stopStack", async (name: unknown, callback: unknown) => {
            try {
                checkLogin(socket);
                if (typeof name !== "string") {
                    throw new ValidationError("Name must be a string");
                }
                const stack = await Stack.getStack(server, name);
                await stack.stop((data) => socket.emit(`stackProgress:${name}`, data));
                await server.sendStackList(socket);
                callbackResult({ ok: true, msg: "Stopped" }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // --- Restart stack ---
        agentSocket.on("restartStack", async (name: unknown, callback: unknown) => {
            try {
                checkLogin(socket);
                if (typeof name !== "string") {
                    throw new ValidationError("Name must be a string");
                }
                const stack = await Stack.getStack(server, name);
                await stack.restart((data) => socket.emit(`stackProgress:${name}`, data));
                await server.sendStackList(socket);
                callbackResult({ ok: true, msg: "Restarted" }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // --- Down stack ---
        agentSocket.on("downStack", async (name: unknown, callback: unknown) => {
            try {
                checkLogin(socket);
                if (typeof name !== "string") {
                    throw new ValidationError("Name must be a string");
                }
                const stack = await Stack.getStack(server, name);
                await stack.down((data) => socket.emit(`stackProgress:${name}`, data));
                await server.sendStackList(socket);
                callbackResult({ ok: true, msg: "Down" }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // --- Update stack (pull + up) ---
        agentSocket.on("updateStack", async (name: unknown, callback: unknown) => {
            try {
                checkLogin(socket);
                if (typeof name !== "string") {
                    throw new ValidationError("Name must be a string");
                }
                const stack = await Stack.getStack(server, name);
                await stack.update((data) => socket.emit(`stackProgress:${name}`, data));
                await server.sendStackList(socket);
                callbackResult({ ok: true, msg: "Updated" }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // --- Docker stats (CPU / memory) ---
        agentSocket.on("dockerStats", async (callback: unknown) => {
            try {
                checkLogin(socket);
                const dockerStats = await this.getDockerStats();
                callbackResult({ ok: true, dockerStats }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // --- Docker network list ---
        agentSocket.on("getDockerNetworkList", async (callback: unknown) => {
            try {
                checkLogin(socket);
                const networks = await this.getDockerNetworkList();
                callbackResult({ ok: true, networks }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // --- Service status list ---
        agentSocket.on("serviceStatusList", async (name: unknown, callback: unknown) => {
            try {
                checkLogin(socket);
                if (typeof name !== "string") {
                    throw new ValidationError("Name must be a string");
                }
                const stack = await Stack.getStack(server, name);
                const list = await stack.getServiceStatusList();
                callbackResult({ ok: true, serviceStatusList: list }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // --- Start individual service ---
        agentSocket.on("startService", async (
            stackName: unknown, serviceName: unknown, callback: unknown,
        ) => {
            try {
                checkLogin(socket);
                if (typeof stackName !== "string") throw new ValidationError("stackName must be a string");
                if (typeof serviceName !== "string") throw new ValidationError("serviceName must be a string");
                const stack = await Stack.getStack(server, stackName);
                await stack.startService(serviceName, (data) => socket.emit(`stackProgress:${stackName}`, data));
                await server.sendStackList(socket);
                callbackResult({ ok: true, msg: `Service ${serviceName} started` }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // --- Stop individual service ---
        agentSocket.on("stopService", async (
            stackName: unknown, serviceName: unknown, callback: unknown,
        ) => {
            try {
                checkLogin(socket);
                if (typeof stackName !== "string") throw new ValidationError("stackName must be a string");
                if (typeof serviceName !== "string") throw new ValidationError("serviceName must be a string");
                const stack = await Stack.getStack(server, stackName);
                await stack.stopService(serviceName, (data) => socket.emit(`stackProgress:${stackName}`, data));
                await server.sendStackList(socket);
                callbackResult({ ok: true, msg: `Service ${serviceName} stopped` }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // --- Restart individual service ---
        agentSocket.on("restartService", async (
            stackName: unknown, serviceName: unknown, callback: unknown,
        ) => {
            try {
                checkLogin(socket);
                if (typeof stackName !== "string") throw new ValidationError("stackName must be a string");
                if (typeof serviceName !== "string") throw new ValidationError("serviceName must be a string");
                const stack = await Stack.getStack(server, stackName);
                await stack.restartService(serviceName, (data) => socket.emit(`stackProgress:${stackName}`, data));
                await server.sendStackList(socket);
                callbackResult({ ok: true, msg: `Service ${serviceName} restarted` }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // --- Request stack logs (streaming) ---
        agentSocket.on("requestStackLogs", async (
            name: unknown, serviceName: unknown, logId: unknown, callback: unknown,
        ) => {
            try {
                checkLogin(socket);
                if (typeof logId !== "string") {
                    throw new ValidationError("Invalid parameters");
                }
                if (typeof serviceName !== "string") {
                    throw new ValidationError("serviceName must be a string");
                }
                // Stack.getStack validates `name`. Validate serviceName here
                // before it lands in docker argv; empty string means "all services".
                if (serviceName !== "") {
                    Stack.validateServiceName(serviceName);
                }

                // Kill existing process for this logId
                this.killLogProcess(logId);

                const stack = await Stack.getStack(server, name as string);
                const args = [
                    "compose",
                    "-f", stack.composeFilePath,
                    "--project-directory", stack.path,
                    "logs", "-f", "--tail", "100", "--no-log-prefix",
                ];

                // If a specific service is requested
                if (serviceName) {
                    args.push(serviceName);
                }

                const child = spawn("docker", args, {
                    cwd: stack.path,
                    stdio: ["ignore", "pipe", "pipe"],
                });

                this.logProcesses.set(logId, child);

                const eventName = `stackLogs:${logId}`;

                child.stdout?.on("data", (data: Buffer) => {
                    socket.emit(eventName, data.toString());
                });

                child.stderr?.on("data", (data: Buffer) => {
                    socket.emit(eventName, data.toString());
                });

                child.on("close", () => {
                    this.logProcesses.delete(logId);
                });

                child.on("error", (err) => {
                    socket.emit(eventName, `\r\n\x1b[31mError: ${err.message}\x1b[0m\r\n`);
                    this.logProcesses.delete(logId);
                });

                callbackResult({ ok: true }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // --- Stop stack logs ---
        agentSocket.on("stopStackLogs", async (logId: unknown, callback: unknown) => {
            try {
                checkLogin(socket);
                if (typeof logId !== "string") {
                    throw new ValidationError("logId must be a string");
                }
                this.killLogProcess(logId);
                callbackResult({ ok: true }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // Clean up all log processes on disconnect
        socket.on("disconnect", () => {
            for (const [id] of this.logProcesses) {
                this.killLogProcess(id);
            }
        });
    }

    private getDockerStats(): Promise<Record<string, Record<string, string>>> {
        return new Promise((resolve) => {
            const child = spawn("docker", ["stats", "--no-stream", "--format", "{{json .}}"], {
                stdio: ["ignore", "pipe", "pipe"],
            });

            let stdout = "";
            child.stdout?.on("data", (data: Buffer) => { stdout += data.toString(); });

            child.on("close", () => {
                const stats: Record<string, Record<string, string>> = {};
                for (const line of stdout.trim().split("\n")) {
                    if (!line) continue;
                    try {
                        const obj = JSON.parse(line);
                        if (obj.Name) {
                            stats[obj.Name] = obj;
                        }
                    } catch {
                        // skip invalid JSON lines
                    }
                }
                resolve(stats);
            });

            child.on("error", () => resolve({}));
        });
    }

    private getDockerNetworkList(): Promise<string[]> {
        return new Promise((resolve) => {
            const child = spawn("docker", ["network", "ls", "--format", "{{.Name}}"], {
                stdio: ["ignore", "pipe", "pipe"],
            });

            let stdout = "";
            child.stdout?.on("data", (data: Buffer) => { stdout += data.toString(); });

            child.on("close", () => {
                const networks = stdout.trim().split("\n").filter(Boolean);
                resolve(networks);
            });

            child.on("error", () => resolve([]));
        });
    }

    private killLogProcess(logId: string) {
        const child = this.logProcesses.get(logId);
        if (child) {
            child.kill("SIGTERM");
            this.logProcesses.delete(logId);
        }
    }

    private async saveStack(
        server: DeckouseServer,
        name: unknown,
        composeYAML: unknown,
        composeENV: unknown,
        isAdd: unknown,
    ): Promise<Stack> {
        if (typeof name !== "string") {
            throw new ValidationError("Name must be a string");
        }
        if (typeof composeYAML !== "string") {
            throw new ValidationError("composeYAML must be a string");
        }
        if (typeof composeENV !== "string") {
            throw new ValidationError("composeENV must be a string");
        }
        if (typeof isAdd !== "boolean") {
            throw new ValidationError("isAdd must be a boolean");
        }

        const stack = new Stack(server, name, composeYAML, composeENV);
        await stack.save(isAdd);
        return stack;
    }
}
