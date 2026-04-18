import { useState, useCallback, useEffect } from "react";
import { useSocketStore } from "@/stores/socket-store";
import type { VolumeInfo } from "@/types/file";
import { toast } from "sonner";

export function useStackVolumes(stackName: string, endpoint: string) {
    const emitAgent = useSocketStore((s) => s.emitAgent);
    const authenticated = useSocketStore((s) => s.authenticated);
    const [volumes, setVolumes] = useState<VolumeInfo[]>([]);
    const [loading, setLoading] = useState(false);

    const refresh = useCallback(() => {
        setLoading(true);
        emitAgent(endpoint, "file:listStackVolumes", stackName, (res: Record<string, unknown>) => {
            setLoading(false);
            if (res.ok) {
                setVolumes(res.volumes as VolumeInfo[]);
            } else {
                toast.error(String(res.msg ?? "Failed to load volumes"));
            }
        });
    }, [stackName, endpoint, emitAgent]);

    useEffect(() => {
        if (!authenticated) return;
        refresh();
    }, [refresh, authenticated]);

    return { volumes, loading, refresh };
}
