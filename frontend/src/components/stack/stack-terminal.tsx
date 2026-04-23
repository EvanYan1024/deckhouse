import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { useSocketStore } from "@/stores/socket-store";
import "@xterm/xterm/css/xterm.css";

interface StackTerminalProps {
    stackName: string;
}

export function StackTerminal({ stackName }: StackTerminalProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const termRef = useRef<Terminal | null>(null);
    const socket = useSocketStore((s) => s.socket);

    useEffect(() => {
        if (!containerRef.current || !socket || !stackName) return;

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

        const tId = `stack-${stackName}-${Date.now()}`;

        socket.emit("openMainTerminal", tId, stackName, (res: { ok: boolean; msg?: string }) => {
            if (res.ok) {
                term.writeln(`\x1b[90m--- Shell opened in stacks/${stackName} ---\x1b[0m`);
                socket.emit("mainTerminalResize", tId, term.cols, term.rows);
            } else {
                term.writeln(`\x1b[31m${res.msg ?? "Failed to open terminal"}\x1b[0m`);
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
    }, [socket, stackName]);

    return (
        <div
            ref={containerRef}
            className="border border-[#30302e] overflow-hidden bg-[#141413]"
            style={{ height: 400 }}
        />
    );
}
