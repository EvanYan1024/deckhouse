import type { DeckouseSocket } from "./util-server";
import type { DeckouseServer } from "./deckhouse-server";

export abstract class SocketHandler {
    abstract create(
        socket: DeckouseSocket,
        server: DeckouseServer
    ): void;
}
