import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { useSocketStore } from "@/stores/socket-store";
import "@xterm/xterm/css/xterm.css";

interface LogsViewProps {
    stackName: string;
    endpoint: string;
}

export function LogsView({ stackName, endpoint }: LogsViewProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const termRef = useRef<Terminal | null>(null);
    const emitAgent = useSocketStore((s) => s.emitAgent);
    const socket = useSocketStore((s) => s.socket);

    const [services, setServices] = useState<string[]>([]);
    const [selectedService, setSelectedService] = useState<string>("__all__");
    const [connected, setConnected] = useState(false);

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

    // Initialize xterm once
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
            scrollback: 5000,
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

    // Subscribe to logs — re-subscribe when selectedService changes
    useEffect(() => {
        if (!socket || !stackName) return;

        const logId = `${stackName}:${selectedService}`;
        const eventName = `stackLogs:${logId}`;

        // Clear terminal on service switch
        termRef.current?.clear();
        setConnected(false);

        const serviceName = selectedService === "__all__" ? "" : selectedService;
        const label = selectedService === "__all__" ? "all services" : selectedService;

        const handleLog = (data: string) => {
            termRef.current?.write(data);
            if (!connected) setConnected(true);
        };

        socket.on(eventName, handleLog);

        emitAgent(endpoint, "requestStackLogs", stackName, serviceName, logId, (res: Record<string, unknown>) => {
            if (res.ok) {
                setConnected(true);
                termRef.current?.writeln(`\x1b[90m--- Streaming logs for ${label} ---\x1b[0m`);
            }
        });

        return () => {
            socket.off(eventName, handleLog);
            emitAgent(endpoint, "stopStackLogs", logId, () => {});
        };
    }, [socket, stackName, selectedService, endpoint, emitAgent]);

    return (
        <div className="space-y-3">
            {/* Service selector */}
            <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[13px] text-[#87867f]">Service:</span>
                <div className="flex gap-1.5 flex-wrap">
                    <ServiceButton
                        label="All"
                        active={selectedService === "__all__"}
                        onClick={() => setSelectedService("__all__")}
                    />
                    {services.map((svc) => (
                        <ServiceButton
                            key={svc}
                            label={svc}
                            active={selectedService === svc}
                            onClick={() => setSelectedService(svc)}
                        />
                    ))}
                </div>
                <span className="ml-auto flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${connected ? "bg-green-500" : "bg-[#87867f]"}`} />
                    <span className="text-[12px] text-[#87867f]">
                        {connected ? "Streaming" : "Connecting..."}
                    </span>
                </span>
            </div>

            {/* Terminal */}
            <div
                ref={containerRef}
                className="rounded-xl border border-[#30302e] overflow-hidden"
                style={{ minHeight: 400 }}
            />
        </div>
    );
}

function ServiceButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={`rounded-lg px-3 py-1 text-[13px] font-medium transition-colors ${
                active
                    ? "bg-[#c96442] text-[#faf9f5] shadow-[0px_0px_0px_1px_#c96442]"
                    : "bg-[#e8e6dc] text-[#4d4c48] shadow-[0px_0px_0px_1px_#d1cfc5] hover:bg-[#d1cfc5] dark:bg-[#30302e] dark:text-[#b0aea5]"
            }`}
        >
            {label}
        </button>
    );
}
