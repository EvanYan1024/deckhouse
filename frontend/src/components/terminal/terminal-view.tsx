import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

interface TerminalViewProps {
    /** Lines of text to display (read-only log viewer) */
    lines?: string[];
    /** Optional className for the container */
    className?: string;
}

/**
 * Simple terminal display component using xterm.js.
 * Currently used as a read-only log viewer.
 * Will be extended for interactive shell in a later phase.
 */
export function TerminalView({ lines, className = "" }: TerminalViewProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const termRef = useRef<Terminal | null>(null);
    const fitRef = useRef<FitAddon | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        const term = new Terminal({
            fontSize: 13,
            fontFamily: "ui-monospace, Consolas, monospace",
            theme: {
                background: "#0a0a0a",
                foreground: "#e5e5e5",
                cursor: "#e5e5e5",
            },
            cursorBlink: false,
            disableStdin: true,
            convertEol: true,
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(containerRef.current);
        fitAddon.fit();

        termRef.current = term;
        fitRef.current = fitAddon;

        const handleResize = () => fitAddon.fit();
        window.addEventListener("resize", handleResize);

        return () => {
            window.removeEventListener("resize", handleResize);
            term.dispose();
        };
    }, []);

    // Write lines when they change
    useEffect(() => {
        const term = termRef.current;
        if (!term || !lines) return;
        term.clear();
        for (const line of lines) {
            term.writeln(line);
        }
    }, [lines]);

    return (
        <div
            ref={containerRef}
            className={`rounded-md overflow-hidden bg-[#0a0a0a] ${className}`}
            style={{ minHeight: 200 }}
        />
    );
}
