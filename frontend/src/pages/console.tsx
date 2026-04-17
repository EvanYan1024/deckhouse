import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { useSocketStore } from "@/stores/socket-store";
import { useAuthStore } from "@/stores/auth-store";
import "@xterm/xterm/css/xterm.css";

export function ConsolePage() {
    const containerRef = useRef<HTMLDivElement>(null);
    const termRef = useRef<Terminal | null>(null);
    const socket = useSocketStore((s) => s.socket);
    const isAdmin = useAuthStore((s) => s.isAdmin);

    useEffect(() => {
        if (!containerRef.current || !socket) return;
        // Host console is admin-only (backend enforces checkAdmin on
        // openMainTerminal). Skip the xterm setup entirely so we don't show
        // an empty black box to non-admins.
        if (!isAdmin) return;

        const term = new Terminal({
            fontSize: 13,
            fontFamily: "ui-monospace, 'SF Mono', Consolas, monospace",
            theme: {
                background: "#141413",
                foreground: "#b0aea5",
                cursor: "#d97757",
                selectionBackground: "#30302e",
            },
            cursorBlink: true,
            convertEol: true,
            scrollback: 10000,
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(containerRef.current);
        requestAnimationFrame(() => fitAddon.fit());
        termRef.current = term;

        const handleResize = () => fitAddon.fit();
        window.addEventListener("resize", handleResize);

        const tId = `main-${Date.now()}`;

        socket.emit("openMainTerminal", tId, (res: { ok: boolean; msg?: string }) => {
            if (res.ok) {
                term.writeln("\x1b[90m--- Host console connected ---\x1b[0m");
                socket.emit("mainTerminalResize", tId, term.cols, term.rows);
            } else {
                term.writeln(`\x1b[31m${res.msg ?? "Failed to open console"}\x1b[0m`);
            }
        });

        const outputEvent = `mainTerminalOutput:${tId}`;
        const handleOutput = (data: string) => term.write(data);
        socket.on(outputEvent, handleOutput);

        term.onData((data) => {
            socket.emit("mainTerminalWrite", tId, data);
        });

        term.onResize(({ cols, rows }) => {
            socket.emit("mainTerminalResize", tId, cols, rows);
        });

        return () => {
            window.removeEventListener("resize", handleResize);
            socket.off(outputEvent, handleOutput);
            socket.emit("closeMainTerminal", tId);
            term.dispose();
            termRef.current = null;
        };
    }, [socket, isAdmin]);

    if (!isAdmin) {
        return (
            <div>
                <h1 className="text-[2rem] mb-6">Console</h1>
                <div className="rounded-xl border border-border p-6">
                    <p className="text-[14px] text-muted-foreground">
                        Admin privilege required to open the host console.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div>
            <h1 className="text-[2rem] mb-6">Console</h1>
            <div
                ref={containerRef}
                className="rounded-xl border border-border overflow-hidden"
                style={{ minHeight: 500 }}
            />
        </div>
    );
}
