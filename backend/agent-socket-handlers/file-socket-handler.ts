import path from "path";
import fsAsync from "fs/promises";
import { AgentSocketHandler } from "../agent-socket-handler";
import type { DeckouseServer } from "../deckhouse-server";
import {
    callbackError,
    callbackResult,
    checkLogin,
    ValidationError,
    type DeckouseSocket,
} from "../util-server";
import { FileManager } from "../file-manager/file-manager";
import { PathValidator } from "../file-manager/path-validator";
import type { AgentSocket } from "../../common/agent-socket";

export class FileSocketHandler extends AgentSocketHandler {
    create(socket: DeckouseSocket, server: DeckouseServer, agentSocket: AgentSocket) {
        const validator = new PathValidator(server.stacksDir);
        const fileManager = new FileManager(validator);

        // --- List directory ---
        agentSocket.on("file:listDir", async (dirPath: unknown, callback: unknown) => {
            try {
                checkLogin(socket);
                if (typeof dirPath !== "string") {
                    throw new ValidationError("Path must be a string");
                }
                const resolvedPath = path.resolve(server.stacksDir, dirPath);
                const entries = await fileManager.listDir(resolvedPath);
                callbackResult({ ok: true, entries }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // --- Read file ---
        agentSocket.on("file:read", async (filePath: unknown, callback: unknown) => {
            try {
                checkLogin(socket);
                if (typeof filePath !== "string") {
                    throw new ValidationError("Path must be a string");
                }
                const resolvedPath = path.resolve(server.stacksDir, filePath);
                const content = await fileManager.readFile(resolvedPath);
                callbackResult({ ok: true, ...content }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // --- Write file ---
        agentSocket.on("file:write", async (filePath: unknown, content: unknown, callback: unknown) => {
            try {
                checkLogin(socket);
                if (typeof filePath !== "string") {
                    throw new ValidationError("Path must be a string");
                }
                if (typeof content !== "string") {
                    throw new ValidationError("Content must be a string");
                }
                const resolvedPath = path.resolve(server.stacksDir, filePath);
                await fileManager.writeFile(resolvedPath, content);
                callbackResult({ ok: true, msg: "File saved" }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // --- Create directory ---
        agentSocket.on("file:createDir", async (dirPath: unknown, callback: unknown) => {
            try {
                checkLogin(socket);
                if (typeof dirPath !== "string") {
                    throw new ValidationError("Path must be a string");
                }
                const resolvedPath = path.resolve(server.stacksDir, dirPath);
                await fileManager.createDir(resolvedPath);
                callbackResult({ ok: true, msg: "Directory created" }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // --- Create file ---
        agentSocket.on("file:createFile", async (filePath: unknown, callback: unknown) => {
            try {
                checkLogin(socket);
                if (typeof filePath !== "string") {
                    throw new ValidationError("Path must be a string");
                }
                const resolvedPath = path.resolve(server.stacksDir, filePath);
                await fileManager.createFile(resolvedPath);
                callbackResult({ ok: true, msg: "File created" }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // --- Delete ---
        agentSocket.on("file:delete", async (itemPath: unknown, callback: unknown) => {
            try {
                checkLogin(socket);
                if (typeof itemPath !== "string") {
                    throw new ValidationError("Path must be a string");
                }
                const resolvedPath = path.resolve(server.stacksDir, itemPath);
                await fileManager.deleteItem(resolvedPath);
                callbackResult({ ok: true, msg: "Deleted" }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // --- Rename ---
        agentSocket.on("file:rename", async (itemPath: unknown, newName: unknown, callback: unknown) => {
            try {
                checkLogin(socket);
                if (typeof itemPath !== "string" || typeof newName !== "string") {
                    throw new ValidationError("Invalid parameters");
                }
                if (newName.includes("/") || newName.includes("\\")) {
                    throw new ValidationError("New name cannot contain path separators");
                }
                const resolvedPath = path.resolve(server.stacksDir, itemPath);
                await fileManager.renameItem(resolvedPath, newName);
                callbackResult({ ok: true, msg: "Renamed" }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // --- Search ---
        agentSocket.on("file:search", async (dirPath: unknown, query: unknown, callback: unknown) => {
            try {
                checkLogin(socket);
                if (typeof dirPath !== "string" || typeof query !== "string") {
                    throw new ValidationError("Invalid parameters");
                }
                const resolvedPath = path.resolve(server.stacksDir, dirPath);
                const results = await fileManager.searchFiles(resolvedPath, query);
                callbackResult({ ok: true, results }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // --- Download (base64, max 10MB) ---
        agentSocket.on("file:download", async (filePath: unknown, callback: unknown) => {
            try {
                checkLogin(socket);
                if (typeof filePath !== "string") {
                    throw new ValidationError("Path must be a string");
                }
                const resolvedPath = path.resolve(server.stacksDir, filePath);
                const safePath = await validator.validate(resolvedPath);
                const stat = await fsAsync.stat(safePath);

                if (stat.size > 10 * 1024 * 1024) {
                    throw new ValidationError("File too large for WebSocket download. Max: 10MB");
                }

                const buffer = await fsAsync.readFile(safePath);
                callbackResult({
                    ok: true,
                    name: path.basename(safePath),
                    content: buffer.toString("base64"),
                    size: stat.size,
                }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // --- Upload (base64, max 50MB) ---
        agentSocket.on("file:upload", async (filePath: unknown, content: unknown, callback: unknown) => {
            try {
                checkLogin(socket);
                if (typeof filePath !== "string" || typeof content !== "string") {
                    throw new ValidationError("Invalid parameters");
                }
                const resolvedPath = path.resolve(server.stacksDir, filePath);
                const safePath = await validator.validate(resolvedPath);
                const buffer = Buffer.from(content, "base64");

                if (buffer.length > 50 * 1024 * 1024) {
                    throw new ValidationError("File too large. Max: 50MB");
                }

                // Node's newer fs types accept Uint8Array but not Buffer
                // directly due to ArrayBufferLike vs ArrayBuffer narrowing.
                await fsAsync.writeFile(
                    safePath,
                    new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength),
                );
                callbackResult({ ok: true, msg: "Uploaded" }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });
    }
}
