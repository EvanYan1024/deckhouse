import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { useSocketStore } from "@/stores/socket-store";
import "@xterm/xterm/css/xterm.css";

interface ProgressTerminalProps {
    stackName: string;
}

export function ProgressTerminal({ stackName }: ProgressTerminalProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const termRef = useRef<Terminal | null>(null);
    const socket = useSocketStore((s) => s.socket);

    useEffect(() => {
        if (!containerRef.current) return;

        const term = new Terminal({
            fontSize: 13,
            fontFamily: "ui-monospace, 'SF Mono', Consolas, monospace",
            theme: {
                background: "#141413",
                foreground: "#b0aea5",
                cursor: "#b0aea5",
                selectionBackground: "#30302e",
            },
            cursorBlink: false,
            disableStdin: true,
            convertEol: true,
            scrollback: 1000,
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(containerRef.current);
        requestAnimationFrame(() => fitAddon.fit());
        termRef.current = term;

        const handleResize = () => fitAddon.fit();
        window.addEventListener("resize", handleResize);

        return () => {
            window.removeEventListener("resize", handleResize);
            term.dispose();
            termRef.current = null;
        };
    }, []);

    useEffect(() => {
        if (!socket || !stackName) return;
        const eventName = `stackProgress:${stackName}`;
        const handleProgress = (data: string) => termRef.current?.write(data);
        socket.on(eventName, handleProgress);
        return () => {
            socket.off(eventName, handleProgress);
        };
    }, [socket, stackName]);

    return (
        <div
            ref={containerRef}
            className="border border-[#30302e] overflow-hidden bg-[#141413]"
            style={{ height: 200 }}
        />
    );
}
