import { useEffect, useState, useCallback } from "react";
import { useSocketStore } from "@/stores/socket-store";
import { toast } from "sonner";
import { Network, Copy, RefreshCw } from "lucide-react";

interface NetworkListProps {
    endpoint: string;
}

export function NetworkList({ endpoint }: NetworkListProps) {
    const emitAgent = useSocketStore((s) => s.emitAgent);
    const [networks, setNetworks] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchNetworks = useCallback(() => {
        setLoading(true);
        emitAgent(endpoint, "getDockerNetworkList", (res: Record<string, unknown>) => {
            setLoading(false);
            if (res.ok) {
                setNetworks(res.networks as string[]);
            }
        });
    }, [endpoint, emitAgent]);

    useEffect(() => {
        fetchNetworks();
    }, [fetchNetworks]);

    const copyToClipboard = (name: string) => {
        navigator.clipboard.writeText(name);
        toast.success(`Copied "${name}"`);
    };

    return (
        <div className="mt-3 rounded-lg border border-border px-4 py-3">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground">
                    <Network className="h-3.5 w-3.5" />
                    Docker Networks
                </div>
                <button
                    onClick={fetchNetworks}
                    disabled={loading}
                    className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Refresh"
                >
                    <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
                {networks.map((name) => (
                    <button
                        key={name}
                        onClick={() => copyToClipboard(name)}
                        className="group inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                        title={`Copy "${name}"`}
                    >
                        {name}
                        <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                ))}
                {networks.length === 0 && !loading && (
                    <span className="text-[12px] text-muted-foreground">No networks found</span>
                )}
            </div>
        </div>
    );
}
