import * as pty from "@homebridge/node-pty-prebuilt-multiarch";
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

export class TerminalSocketHandler extends AgentSocketHandler {
    private terminals: Map<string, pty.IPty> = new Map();

    create(socket: DeckouseSocket, server: DeckouseServer, agentSocket: AgentSocket) {

        // Open interactive terminal in a container
        agentSocket.on("openTerminal", async (
            stackName: unknown, serviceName: unknown, terminalId: unknown, callback: unknown,
        ) => {
            try {
                checkLogin(socket);
                if (typeof terminalId !== "string") throw new ValidationError("terminalId must be a string");
                // Stack.getStack validates stackName; validate serviceName before it
                // reaches the docker argv (prevents `--privileged`-style injection)
                if (typeof serviceName !== "string") throw new ValidationError("serviceName must be a string");
                Stack.validateServiceName(serviceName);

                // Kill existing terminal with same ID
                this.killTerminal(terminalId);

                const stack = await Stack.getStack(server, stackName as string);

                const args = [
                    "compose",
                    "-f", stack.composeFilePath,
                    "--project-directory", stack.path,
                    "exec", serviceName, "sh",
                ];

                const ptyProcess = pty.spawn("docker", args, {
                    name: "xterm-256color",
                    cwd: stack.path,
                    cols: 80,
                    rows: 24,
                    env: process.env as unknown as Record<string, string>,
                });

                this.terminals.set(terminalId, ptyProcess);

                const outputEvent = `terminalOutput:${terminalId}`;

                ptyProcess.onData((data) => {
                    socket.emit(outputEvent, data);
                });

                ptyProcess.onExit(() => {
                    socket.emit(outputEvent, "\r\n\x1b[90m--- Terminal exited ---\x1b[0m\r\n");
                    this.terminals.delete(terminalId);
                });

                callbackResult({ ok: true }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // Write to terminal stdin
        agentSocket.on("terminalWrite", async (
            terminalId: unknown, data: unknown, callback: unknown,
        ) => {
            try {
                checkLogin(socket);
                if (typeof terminalId !== "string") throw new ValidationError("terminalId must be a string");
                if (typeof data !== "string") throw new ValidationError("data must be a string");

                const ptyProcess = this.terminals.get(terminalId);
                if (!ptyProcess) throw new ValidationError("Terminal not found");

                ptyProcess.write(data);
                callbackResult({ ok: true }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // Resize terminal
        agentSocket.on("terminalResize", async (
            terminalId: unknown, cols: unknown, rows: unknown, callback: unknown,
        ) => {
            try {
                checkLogin(socket);
                if (typeof terminalId !== "string") throw new ValidationError("terminalId must be a string");
                if (typeof cols !== "number" || typeof rows !== "number") {
                    throw new ValidationError("cols and rows must be numbers");
                }

                const ptyProcess = this.terminals.get(terminalId);
                if (!ptyProcess) throw new ValidationError("Terminal not found");

                ptyProcess.resize(cols, rows);
                callbackResult({ ok: true }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // Close terminal
        agentSocket.on("closeTerminal", async (
            terminalId: unknown, callback: unknown,
        ) => {
            try {
                checkLogin(socket);
                if (typeof terminalId !== "string") throw new ValidationError("terminalId must be a string");
                this.killTerminal(terminalId);
                callbackResult({ ok: true }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // Clean up all terminals on disconnect
        socket.on("disconnect", () => {
            for (const [id] of this.terminals) {
                this.killTerminal(id);
            }
        });
    }

    private killTerminal(terminalId: string) {
        const ptyProcess = this.terminals.get(terminalId);
        if (ptyProcess) {
            ptyProcess.kill();
            this.terminals.delete(terminalId);
        }
    }
}
