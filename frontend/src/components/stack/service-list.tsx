import { useEffect, useState, useCallback, useRef } from "react";
import { useSocketStore } from "@/stores/socket-store";
import { useStack } from "@/hooks/use-stack";
import { toast } from "sonner";
import { Play, Square, RotateCcw, Loader2, Cpu, MemoryStick } from "lucide-react";

interface Publisher {
    URL: string;
    TargetPort: number;
    PublishedPort: number;
    Protocol: string;
}

interface ServiceStatus {
    Service: string;
    State: string;
    Health?: string;
    Name: string;
    Image?: string;
    Publishers?: Publisher[];
}

interface DockerStats {
    Name: string;
    CPUPerc: string;
    MemUsage: string;
    MemPerc: string;
    NetIO: string;
    BlockIO: string;
    PIDs: string;
}

interface ServiceListProps {
    stackName: string;
    endpoint: string;
}

export function ServiceList({ stackName, endpoint }: ServiceListProps) {
    const emitAgent = useSocketStore((s) => s.emitAgent);
    const stackList = useSocketStore((s) => s.stackList);
    const stackOps = useStack(stackName, endpoint);
    const [services, setServices] = useState<ServiceStatus[]>([]);
    const [loadingService, setLoadingService] = useState<string | null>(null);
    const [dockerStats, setDockerStats] = useState<Record<string, DockerStats>>({});
    const statsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchServices = useCallback(() => {
        emitAgent(endpoint, "serviceStatusList", stackName, (res: Record<string, unknown>) => {
            if (res.ok) {
                setServices(res.serviceStatusList as ServiceStatus[]);
            }
        });
    }, [stackName, endpoint, emitAgent]);

    const fetchStats = useCallback(() => {
        emitAgent(endpoint, "dockerStats", (res: Record<string, unknown>) => {
            if (res.ok) {
                setDockerStats(res.dockerStats as Record<string, DockerStats>);
            }
        });
    }, [endpoint, emitAgent]);

    // Fetch on mount and when stack status changes
    const stackStatus = stackList[stackName]?.status;
    useEffect(() => {
        fetchServices();
    }, [fetchServices, stackStatus]);

    // Poll docker stats every 5s while any service is running
    const hasRunningService = services.some(
        (svc) => (svc.Health || svc.State) === "running" || (svc.Health || svc.State) === "healthy"
    );
    useEffect(() => {
        if (!hasRunningService) {
            setDockerStats({});
            return;
        }
        fetchStats();
        statsIntervalRef.current = setInterval(fetchStats, 5000);
        return () => {
            if (statsIntervalRef.current) {
                clearInterval(statsIntervalRef.current);
                statsIntervalRef.current = null;
            }
        };
    }, [hasRunningService, fetchStats]);

    const handleAction = async (action: "start" | "stop" | "restart", serviceName: string) => {
        setLoadingService(serviceName);
        try {
            const pastTense = { start: "started", stop: "stopped", restart: "restarted" } as const;
            if (action === "start") await stackOps.startService(serviceName);
            else if (action === "stop") await stackOps.stopService(serviceName);
            else await stackOps.restartService(serviceName);
            toast.success(`Service ${serviceName} ${pastTense[action]}`);
        } catch {
            // error toast handled by hook
        } finally {
            setLoadingService(null);
            fetchServices();
        }
    };

    if (services.length === 0) return null;

    return (
        <div className="mb-6">
            <h3 className="text-[13px] font-medium text-muted-foreground mb-2">Services</h3>
            <div className="rounded-lg border border-border divide-y divide-border">
                {services.map((svc) => {
                    const status = svc.Health || svc.State;
                    const isRunning = status === "running" || status === "healthy";
                    const isLoading = loadingService === svc.Service;
                    const ports = [...new Set(
                        (svc.Publishers ?? [])
                            .filter((p) => p.PublishedPort > 0)
                            .map((p) => p.PublishedPort)
                    )].sort((a, b) => a - b);

                    return (
                        <div key={svc.Name} className="flex items-start gap-4 px-4 py-3">
                            {/* Left: service info */}
                            <div className="flex flex-col gap-1.5 min-w-0">
                                <span className="text-[15px] font-semibold leading-tight">
                                    {svc.Service}
                                </span>
                                {svc.Image && (
                                    <span className="text-[12px] text-muted-foreground truncate">
                                        {svc.Image}
                                    </span>
                                )}
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    {/* Status badge */}
                                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                        isRunning
                                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                            : "bg-muted text-muted-foreground"
                                    }`}>
                                        <span className={`h-1.5 w-1.5 rounded-full ${
                                            isRunning ? "bg-green-500" : "bg-[#87867f]"
                                        }`} />
                                        {status}
                                    </span>
                                    {/* Port badges */}
                                    {ports.map((port) => (
                                        <a
                                            key={port}
                                            href={`http://${window.location.hostname}:${port}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center rounded-full bg-[#1c1c1c] px-2 py-0.5 text-[11px] font-medium text-[#e8e6dc] transition-opacity hover:opacity-80 dark:bg-[#e8e6dc] dark:text-[#1c1c1c]"
                                        >
                                            {port}
                                        </a>
                                    ))}
                                    {/* Stats badges */}
                                    {(() => {
                                        const stats = dockerStats[svc.Name];
                                        if (!stats || !isRunning) return null;
                                        return (
                                            <>
                                                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-muted text-muted-foreground">
                                                    <Cpu className="h-3 w-3" />
                                                    {stats.CPUPerc}
                                                </span>
                                                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-muted text-muted-foreground">
                                                    <MemoryStick className="h-3 w-3" />
                                                    {stats.MemUsage}
                                                </span>
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>

                            {/* Right: action buttons */}
                            <div className="ml-auto flex gap-1 shrink-0 pt-0.5">
                                {isLoading ? (
                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                ) : (
                                    <>
                                        {!isRunning && (
                                            <ActionButton
                                                icon={<Play className="h-3.5 w-3.5" />}
                                                title="Start"
                                                onClick={() => handleAction("start", svc.Service)}
                                            />
                                        )}
                                        {isRunning && (
                                            <>
                                                <ActionButton
                                                    icon={<RotateCcw className="h-3.5 w-3.5" />}
                                                    title="Restart"
                                                    onClick={() => handleAction("restart", svc.Service)}
                                                />
                                                <ActionButton
                                                    icon={<Square className="h-3.5 w-3.5" />}
                                                    title="Stop"
                                                    onClick={() => handleAction("stop", svc.Service)}
                                                />
                                            </>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function ActionButton({ icon, title, onClick }: { icon: React.ReactNode; title: string; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title={title}
        >
            {icon}
        </button>
    );
}
