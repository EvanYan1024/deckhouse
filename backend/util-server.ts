import { Socket } from "socket.io";
import type { DeckouseServer, UserRecord } from "./deckhouse-server";

// --- Custom Error ---

export class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ValidationError";
    }
}

// --- Extended Socket Interface ---

export interface DeckouseSocket extends Socket {
    userID: number;
    endpoint: string;
}

// --- JWT Decoded Payload ---

export interface JWTDecoded {
    username: string;
    h?: string;
}

// --- Callback Helpers ---

export function callbackResult(result: unknown, callback: unknown) {
    if (typeof callback === "function") {
        callback(result);
    }
}

export function callbackError(error: unknown, callback: unknown) {
    let msg: string;
    if (error instanceof Error) {
        msg = error.message;
    } else if (typeof error === "string") {
        msg = error;
    } else {
        msg = "Unknown error";
    }

    if (typeof callback === "function") {
        callback({ ok: false, msg });
    }
}

// --- Auth Check ---

export function checkLogin(socket: DeckouseSocket) {
    if (!socket.userID) {
        throw new Error("Not logged in");
    }
}

export function currentUser(socket: DeckouseSocket, server: DeckouseServer): UserRecord {
    checkLogin(socket);
    const user = [...server.users.values()].find((u) => u.id === socket.userID);
    if (!user) {
        throw new Error("User not found");
    }
    return user;
}

export function checkAdmin(socket: DeckouseSocket, server: DeckouseServer): UserRecord {
    const user = currentUser(socket, server);
    if (!user.isAdmin) {
        throw new ValidationError("Admin privilege required");
    }
    return user;
}
