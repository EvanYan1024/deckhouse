import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import composerize from "composerize";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import * as pty from "@homebridge/node-pty-prebuilt-multiarch";
import { SocketHandler } from "../socket-handler";
import type { DeckouseServer, ServerSettings } from "../deckhouse-server";
import {
    callbackError,
    callbackResult,
    checkAdmin,
    checkLogin,
    currentUser,
    ValidationError,
    type DeckouseSocket,
    type JWTDecoded,
} from "../util-server";

export class MainSocketHandler extends SocketHandler {
    // Per-connection state — this handler is instantiated fresh for each socket
    private mainTerminals: Map<string, pty.IPty> = new Map();

    create(socket: DeckouseSocket, server: DeckouseServer) {
        // --- Setup (first user creation) ---
        socket.on("setup", async (data: unknown, callback: unknown) => {
            try {
                if (server.needSetup === false) {
                    throw new ValidationError("Setup already completed");
                }
                if (server.setupInProgress) {
                    throw new ValidationError("Setup already in progress");
                }
                server.setupInProgress = true;
                if (typeof data !== "object" || data === null) {
                    throw new ValidationError("Invalid data");
                }
                const { username, password } = data as Record<string, unknown>;
                if (typeof username !== "string" || typeof password !== "string") {
                    throw new ValidationError("Username and password must be strings");
                }
                if (username.length < 3) {
                    throw new ValidationError("Username must be at least 3 characters");
                }
                if (password.length < 6) {
                    throw new ValidationError("Password must be at least 6 characters");
                }

                const hash = await bcrypt.hash(password, 10);
                server.users.set(username, { id: 1, username, password: hash, isAdmin: true });
                server.needSetup = false;
                server.saveUsers();

                const token = this.createJWT(username, hash, server.jwtSecret);
                server.afterLogin(socket, 1);

                callbackResult({ ok: true, token, isAdmin: true }, callback);
            } catch (e) {
                callbackError(e, callback);
            } finally {
                server.setupInProgress = false;
            }
        });

        // --- Login ---
        socket.on("login", async (data: unknown, callback: unknown) => {
            try {
                if (typeof data !== "object" || data === null) {
                    throw new ValidationError("Invalid data");
                }
                const { username, password } = data as Record<string, unknown>;
                if (typeof username !== "string" || typeof password !== "string") {
                    throw new ValidationError("Invalid credentials");
                }

                const user = server.users.get(username);
                if (!user) {
                    throw new ValidationError("Invalid username or password");
                }

                const match = await bcrypt.compare(password, user.password);
                if (!match) {
                    throw new ValidationError("Invalid username or password");
                }

                const token = this.createJWT(username, user.password, server.jwtSecret);
                server.afterLogin(socket, user.id);

                callbackResult({ ok: true, token, isAdmin: user.isAdmin }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // --- Login by token ---
        socket.on("loginByToken", async (token: unknown, callback: unknown) => {
            try {
                if (typeof token !== "string") {
                    throw new ValidationError("Invalid token");
                }

                const decoded = jwt.verify(token, server.jwtSecret) as JWTDecoded;
                const user = server.users.get(decoded.username);

                if (!user) {
                    throw new ValidationError("User not found");
                }

                // Reject tokens issued before the user's password was changed
                if (decoded.h !== passwordFingerprint(user.password)) {
                    throw new ValidationError("Token is no longer valid — please log in again");
                }

                server.afterLogin(socket, user.id);
                callbackResult({ ok: true, isAdmin: user.isAdmin }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // --- Change password ---
        socket.on("changePassword", async (data: unknown, callback: unknown) => {
            try {
                const user = currentUser(socket, server);
                if (typeof data !== "object" || data === null) {
                    throw new ValidationError("Invalid data");
                }
                const { currentPassword, newPassword } = data as Record<string, unknown>;
                if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
                    throw new ValidationError("Passwords must be strings");
                }
                if (newPassword.length < 6) {
                    throw new ValidationError("New password must be at least 6 characters");
                }

                const match = await bcrypt.compare(currentPassword, user.password);
                if (!match) {
                    throw new ValidationError("Current password is incorrect");
                }

                const hash = await bcrypt.hash(newPassword, 10);
                user.password = hash;
                server.saveUsers();

                const token = this.createJWT(user.username, hash, server.jwtSecret);
                callbackResult({ ok: true, msg: "Password changed", token }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // --- List users ---
        socket.on("listUsers", async (callback: unknown) => {
            try {
                checkAdmin(socket, server);
                const users = [...server.users.values()].map((u) => ({
                    id: u.id,
                    username: u.username,
                    isAdmin: u.isAdmin,
                }));
                callbackResult({ ok: true, users }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // --- Add user ---
        socket.on("addUser", async (data: unknown, callback: unknown) => {
            try {
                checkAdmin(socket, server);
                if (typeof data !== "object" || data === null) {
                    throw new ValidationError("Invalid data");
                }
                const { username, password, isAdmin } = data as Record<string, unknown>;
                if (typeof username !== "string" || typeof password !== "string") {
                    throw new ValidationError("Username and password must be strings");
                }
                if (username.length < 3) {
                    throw new ValidationError("Username must be at least 3 characters");
                }
                if (password.length < 6) {
                    throw new ValidationError("Password must be at least 6 characters");
                }
                if (server.users.has(username)) {
                    throw new ValidationError("Username already exists");
                }

                const nextId = Math.max(0, ...[...server.users.values()].map((u) => u.id)) + 1;
                const hash = await bcrypt.hash(password, 10);
                server.users.set(username, {
                    id: nextId, username, password: hash, isAdmin: isAdmin === true,
                });
                server.saveUsers();

                callbackResult({ ok: true, msg: "User added" }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // --- Delete user ---
        socket.on("deleteUser", async (username: unknown, callback: unknown) => {
            try {
                const me = checkAdmin(socket, server);
                if (typeof username !== "string") {
                    throw new ValidationError("Username must be a string");
                }
                if (me.username === username) {
                    throw new ValidationError("Cannot delete your own account");
                }
                const target = server.users.get(username);
                if (!target) {
                    throw new ValidationError("User not found");
                }
                // Don't allow removing the last remaining admin
                if (target.isAdmin) {
                    const adminCount = [...server.users.values()].filter((u) => u.isAdmin).length;
                    if (adminCount <= 1) {
                        throw new ValidationError("Cannot delete the last admin");
                    }
                }
                server.users.delete(username);
                server.saveUsers();

                callbackResult({ ok: true, msg: "User deleted" }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // --- Composerize (docker run → compose YAML) ---
        socket.on("composerize", async (dockerRunCommand: unknown, callback: unknown) => {
            try {
                checkLogin(socket);
                if (typeof dockerRunCommand !== "string") {
                    throw new ValidationError("dockerRunCommand must be a string");
                }

                let composeTemplate = composerize(dockerRunCommand, "", "latest");
                // Remove the first line "name: <your project name>"
                composeTemplate = composeTemplate.split("\n").slice(1).join("\n");

                callbackResult({ ok: true, composeTemplate }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // --- Get settings ---
        socket.on("getSettings", async (callback: unknown) => {
            try {
                checkLogin(socket);
                callbackResult({ ok: true, settings: server.settings }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // --- Set settings ---
        socket.on("setSettings", async (data: unknown, callback: unknown) => {
            try {
                checkAdmin(socket, server);
                if (typeof data !== "object" || data === null) {
                    throw new ValidationError("Invalid settings data");
                }
                const incoming = data as Partial<ServerSettings>;
                if (incoming.primaryDomain !== undefined) {
                    if (typeof incoming.primaryDomain !== "string") {
                        throw new ValidationError("primaryDomain must be a string");
                    }
                    server.settings.primaryDomain = incoming.primaryDomain;
                }
                server.saveSettings();
                callbackResult({ ok: true, msg: "Settings saved" }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // --- Get global env ---
        socket.on("getGlobalEnv", async (callback: unknown) => {
            try {
                checkLogin(socket);
                const envPath = path.join(server.stacksDir, "global.env");
                let content = "";
                if (fs.existsSync(envPath)) {
                    content = fs.readFileSync(envPath, "utf-8");
                }
                callbackResult({ ok: true, globalEnv: content }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // --- Set global env ---
        socket.on("setGlobalEnv", async (content: unknown, callback: unknown) => {
            try {
                checkAdmin(socket, server);
                if (typeof content !== "string") {
                    throw new ValidationError("content must be a string");
                }
                const envPath = path.join(server.stacksDir, "global.env");
                fs.writeFileSync(envPath, content, "utf-8");
                callbackResult({ ok: true, msg: "Global environment saved" }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // --- Get server info ---
        socket.on("getInfo", async (callback: unknown) => {
            callbackResult({
                ok: true,
                version: "0.1.0",
                needSetup: server.needSetup,
                consoleEnabled: process.env.DECKHOUSE_ENABLE_CONSOLE === "1",
            }, callback);
        });

        // --- Host console (main terminal) ---
        socket.on("openMainTerminal", async (terminalId: unknown, callback: unknown) => {
            try {
                checkAdmin(socket, server);
                if (process.env.DECKHOUSE_ENABLE_CONSOLE !== "1") {
                    throw new ValidationError("Host console is disabled. Set DECKHOUSE_ENABLE_CONSOLE=1 to enable.");
                }
                if (typeof terminalId !== "string") throw new ValidationError("terminalId must be a string");

                this.killMainTerminal(terminalId);

                const shell = process.env.SHELL || "/bin/bash";
                const ptyProcess = pty.spawn(shell, [], {
                    name: "xterm-256color",
                    cwd: server.stacksDir,
                    cols: 80,
                    rows: 24,
                    env: process.env as unknown as Record<string, string>,
                });

                this.mainTerminals.set(terminalId, ptyProcess);
                const outputEvent = `mainTerminalOutput:${terminalId}`;

                ptyProcess.onData((data) => {
                    socket.emit(outputEvent, data);
                });

                ptyProcess.onExit(() => {
                    socket.emit(outputEvent, "\r\n\x1b[90m--- Terminal exited ---\x1b[0m\r\n");
                    this.mainTerminals.delete(terminalId);
                });

                callbackResult({ ok: true }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        socket.on("mainTerminalWrite", async (terminalId: unknown, data: unknown) => {
            if (typeof terminalId !== "string" || typeof data !== "string") return;
            const ptyProcess = this.mainTerminals.get(terminalId);
            if (ptyProcess) ptyProcess.write(data);
        });

        socket.on("mainTerminalResize", async (terminalId: unknown, cols: unknown, rows: unknown) => {
            if (typeof terminalId !== "string" || typeof cols !== "number" || typeof rows !== "number") return;
            const ptyProcess = this.mainTerminals.get(terminalId);
            if (ptyProcess) ptyProcess.resize(cols, rows);
        });

        socket.on("closeMainTerminal", async (terminalId: unknown) => {
            if (typeof terminalId !== "string") return;
            this.killMainTerminal(terminalId);
        });

        socket.on("disconnect", () => {
            for (const [id] of this.mainTerminals) {
                this.killMainTerminal(id);
            }
        });

        // --- Get stack list (triggered by client) ---
        socket.on("requestStackList", async (callback: unknown) => {
            try {
                checkLogin(socket);
                await server.sendStackList(socket);
                callbackResult({ ok: true }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });
    }

    private killMainTerminal(terminalId: string) {
        const ptyProcess = this.mainTerminals.get(terminalId);
        if (ptyProcess) {
            ptyProcess.kill();
            this.mainTerminals.delete(terminalId);
        }
    }

    private createJWT(username: string, passwordHash: string, secret: string): string {
        return jwt.sign(
            { username, h: passwordFingerprint(passwordHash) } as JWTDecoded,
            secret,
            { expiresIn: "48h" }
        );
    }
}

// Fingerprint the bcrypt hash so any password change invalidates existing tokens.
// We don't put the raw hash in the JWT because the token is visible to the client.
export function passwordFingerprint(passwordHash: string): string {
    return crypto.createHash("sha256").update(passwordHash).digest("hex").slice(0, 16);
}
