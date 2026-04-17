import type { DeckouseSocket } from "./util-server";
import type { DeckouseServer } from "./deckhouse-server";
import type { AgentSocket } from "../common/agent-socket";

export abstract class AgentSocketHandler {
    abstract create(
        socket: DeckouseSocket,
        server: DeckouseServer,
        agentSocket: AgentSocket
    ): void;
}
