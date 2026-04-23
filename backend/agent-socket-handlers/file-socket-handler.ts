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
import { Stack } from "../stack";
import type { AgentSocket } from "../../common/agent-socket";

const VOLUME_PREFIX = "@vol/";

interface FileContext {
    fileManager: FileManager;
    validator: PathValidator;
    absolutePath: string;
}

/**
 * Resolve a client-supplied path to (fileManager, absolutePath). Two forms:
 *
 *   `<stackName>[/sub]`
 *     — regular stack-scoped browsing, validator roots at stacksDir.
 *
 *   `@vol/<stackName>/<urlencodedSource>[/sub]`
 *     — volume browsing. The source is matched against the declared volumes
 *     of the stack; the validator is then scoped to that single volume's
 *     resolved host path, so crossing into another volume or anywhere else
 *     on disk is rejected.
 */
async function resolveFileContext(
    server: DeckouseServer,
    inputPath: string,
): Promise<FileContext> {
    if (inputPath.startsWith(VOLUME_PREFIX)) {
        const rest = inputPath.slice(VOLUME_PREFIX.length);
        const slash1 = rest.indexOf("/");
        if (slash1 < 0) {
            throw new ValidationError("Invalid volume path: missing stack name");
        }
        const stackName = rest.slice(0, slash1);
        const afterStack = rest.slice(slash1 + 1);

        const slash2 = afterStack.indexOf("/");
        const encodedSource = slash2 < 0 ? afterStack : afterStack.slice(0, slash2);
        const subPath = slash2 < 0 ? "" : afterStack.slice(slash2 + 1);

        if (!encodedSource) {
            throw new ValidationError("Invalid volume path: missing source");
        }

        let source: string;
        try {
            source = decodeURIComponent(encodedSource);
        } catch {
            throw new ValidationError("Invalid volume path encoding");
        }

        const stack = await Stack.getStack(server, stackName);
        const volumes = await stack.getVolumes();
        const match = volumes.find((v) => v.source === source);
        if (!match) {
            throw new ValidationError(
                `Volume "${source}" is not declared in stack "${stackName}"`,
            );
        }

        const validator = new PathValidator(match.resolvedSource);
        const fileManager = new FileManager(validator);
        const absolutePath = path.resolve(match.resolvedSource, subPath);
        return { fileManager, validator, absolutePath };
    }

    const validator = new PathValidator(server.stacksDir);
    const fileManager = new FileManager(validator);
    const absolutePath = path.resolve(server.stacksDir, inputPath);
    return { fileManager, validator, absolutePath };
}

export class FileSocketHandler extends AgentSocketHandler {
    create(socket: DeckouseSocket, server: DeckouseServer, agentSocket: AgentSocket) {

        // --- List declared bind-mount volumes for a stack ---
        agentSocket.on("file:listStackVolumes", async (stackName: unknown, callback: unknown) => {
            try {
                checkLogin(socket);
                if (typeof stackName !== "string") {
                    throw new ValidationError("stackName must be a string");
                }
                const stack = await Stack.getStack(server, stackName);
                const volumes = await stack.getVolumes();
                callbackResult({ ok: true, volumes }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // --- List directory ---
        agentSocket.on("file:listDir", async (dirPath: unknown, callback: unknown) => {
            try {
                checkLogin(socket);
                if (typeof dirPath !== "string") {
                    throw new ValidationError("Path must be a string");
                }
                const ctx = await resolveFileContext(server, dirPath);
                try {
                    const entries = await ctx.fileManager.listDir(ctx.absolutePath);
                    callbackResult({ ok: true, entries }, callback);
                } catch (inner) {
                    // Bind-mount host paths are often created lazily by
                    // `docker compose up` or by the user. Don't surface ENOENT
                    // as an error — let the UI offer to create the directory.
                    if ((inner as NodeJS.ErrnoException).code === "ENOENT") {
                        callbackResult(
                            { ok: true, entries: [], notExists: true },
                            callback,
                        );
                        return;
                    }
                    throw inner;
                }
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
                const ctx = await resolveFileContext(server, filePath);
                const content = await ctx.fileManager.readFile(ctx.absolutePath);
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
                const ctx = await resolveFileContext(server, filePath);
                await ctx.fileManager.writeFile(ctx.absolutePath, content);
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
                const ctx = await resolveFileContext(server, dirPath);
                await ctx.fileManager.createDir(ctx.absolutePath);
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
                const ctx = await resolveFileContext(server, filePath);
                await ctx.fileManager.createFile(ctx.absolutePath);
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
                const ctx = await resolveFileContext(server, itemPath);
                await ctx.fileManager.deleteItem(ctx.absolutePath);
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
                const ctx = await resolveFileContext(server, itemPath);
                await ctx.fileManager.renameItem(ctx.absolutePath, newName);
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
                const ctx = await resolveFileContext(server, dirPath);
                const results = await ctx.fileManager.searchFiles(ctx.absolutePath, query);
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
                const ctx = await resolveFileContext(server, filePath);
                const safePath = await ctx.validator.validate(ctx.absolutePath);
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
                const ctx = await resolveFileContext(server, filePath);
                const safePath = await ctx.validator.validate(ctx.absolutePath);
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
