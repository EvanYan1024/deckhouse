import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { useSocketStore } from "@/stores/socket-store";
import "@xterm/xterm/css/xterm.css";

interface ContainerTerminalProps {
    stackName: string;
    endpoint: string;
}

/**
 * Interactive terminal for `docker compose exec <service> sh`.
 * User selects a service, then gets a live shell session.
 */
export function ContainerTerminal({ stackName, endpoint }: ContainerTerminalProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const termRef = useRef<Terminal | null>(null);
    const emitAgent = useSocketStore((s) => s.emitAgent);
    const socket = useSocketStore((s) => s.socket);

    const [services, setServices] = useState<string[]>([]);
    const [selectedService, setSelectedService] = useState<string | null>(null);

    // Fetch service list
    useEffect(() => {
        if (!stackName) return;
        emitAgent(endpoint, "serviceStatusList", stackName, (res: Record<string, unknown>) => {
            if (res.ok) {
                const list = res.serviceStatusList as Array<{ Service?: string; Name?: string }>;
                const names = list.map((s) => s.Service ?? s.Name ?? "").filter(Boolean);
                setServices([...new Set(names)]);
            }
        });
    }, [stackName, endpoint, emitAgent]);

    // Initialize xterm
    useEffect(() => {
        if (!containerRef.current || !selectedService) return;

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
            scrollback: 5000,
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(containerRef.current);
        requestAnimationFrame(() => fitAddon.fit());
        termRef.current = term;

        const handleResize = () => fitAddon.fit();
        window.addEventListener("resize", handleResize);

        // Open terminal on backend
        const tId = `${stackName}-${selectedService}-${Date.now()}`;

        emitAgent(endpoint, "openTerminal", stackName, selectedService, tId, () => {
            term.writeln(`\x1b[90m--- Connected to ${selectedService} ---\x1b[0m`);
            // Sync terminal size to backend PTY
            emitAgent(endpoint, "terminalResize", tId, term.cols, term.rows, () => {});
        });

        // Receive output
        const outputEvent = `terminalOutput:${tId}`;
        const handleOutput = (data: string) => term.write(data);
        socket?.on(outputEvent, handleOutput);

        // Send input
        term.onData((data) => {
            emitAgent(endpoint, "terminalWrite", tId, data, () => {});
        });

        // Send resize
        term.onResize(({ cols, rows }) => {
            emitAgent(endpoint, "terminalResize", tId, cols, rows, () => {});
        });

        return () => {
            window.removeEventListener("resize", handleResize);
            socket?.off(outputEvent, handleOutput);
            emitAgent(endpoint, "closeTerminal", tId, () => {});
            term.dispose();
            termRef.current = null;
        };
    }, [selectedService, stackName, endpoint, socket, emitAgent]);

    return (
        <div className="space-y-3">
            {/* Service selector */}
            <div className="flex items-center gap-2">
                <span className="text-[13px] text-[#87867f]">Service:</span>
                <div className="flex gap-1.5">
                    {services.length === 0 && (
                        <span className="text-[13px] text-[#87867f]">No running services</span>
                    )}
                    {services.map((svc) => (
                        <button
                            key={svc}
                            onClick={() => setSelectedService(svc)}
                            className={`rounded-lg px-3 py-1 text-[13px] font-medium transition-colors ${
                                selectedService === svc
                                    ? "bg-[#c96442] text-[#faf9f5] shadow-[0px_0px_0px_1px_#c96442]"
                                    : "bg-[#e8e6dc] text-[#4d4c48] shadow-[0px_0px_0px_1px_#d1cfc5] hover:bg-[#d1cfc5] dark:bg-[#30302e] dark:text-[#b0aea5]"
                            }`}
                        >
                            {svc}
                        </button>
                    ))}
                </div>
            </div>

            {/* Terminal */}
            {selectedService ? (
                <div
                    ref={containerRef}
                    className="rounded-xl border border-[#30302e] overflow-hidden"
                    style={{ minHeight: 400 }}
                />
            ) : (
                <div className="flex items-center justify-center rounded-xl border border-[#e8e6dc] bg-[#f0eee6] py-16 dark:border-[#30302e] dark:bg-[#1e1e1c]">
                    <p className="text-[15px] text-[#87867f]">Select a service to open a terminal</p>
                </div>
            )}
        </div>
    );
}
