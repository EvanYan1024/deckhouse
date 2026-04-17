/**
 * Simple event emitter for agent socket communication.
 * Maps event names to callback handlers.
 * Used both for direct local calls and as a proxy target for remote agents.
 *
 * Registering two handlers for the same event throws — the prior Map.set-based
 * impl would silently override the first registration, hiding handler conflicts
 * until a user hit the specific event.
 */
export class AgentSocket {
    eventList: Map<string, (...args: unknown[]) => void> = new Map();

    on(event: string, callback: (...args: unknown[]) => void) {
        if (this.eventList.has(event)) {
            throw new Error(`AgentSocket event "${event}" already has a handler`);
        }
        this.eventList.set(event, callback);
    }

    call(eventName: string, ...args: unknown[]) {
        const callback = this.eventList.get(eventName);
        if (callback) {
            callback(...args);
        }
    }
}
