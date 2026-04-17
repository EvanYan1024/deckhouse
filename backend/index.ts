import { DeckouseServer } from "./deckhouse-server";

const server = new DeckouseServer();

server.start().then(() => {
    console.log("Deckhouse server started");
}).catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
});

// Graceful shutdown — required for tsx watch to restart cleanly
function shutdown() {
    server.io.close();
    server.httpServer.close(() => {
        process.exit(0);
    });
    // Force exit if close hangs
    setTimeout(() => process.exit(0), 2000);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
