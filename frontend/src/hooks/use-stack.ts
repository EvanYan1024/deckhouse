import { useCallback } from "react";
import { useSocketStore } from "@/stores/socket-store";
import { toast } from "sonner";

export function useStack(stackName: string, endpoint: string = "") {
    const emitAgent = useSocketStore((s) => s.emitAgent);

    const withCallback = useCallback(
        (event: string, ...args: unknown[]) => {
            return new Promise<Record<string, unknown>>((resolve, reject) => {
                emitAgent(endpoint, event, ...args, (res: Record<string, unknown>) => {
                    if (res.ok) {
                        resolve(res);
                    } else {
                        toast.error(String(res.msg ?? "Operation failed"));
                        reject(new Error(String(res.msg)));
                    }
                });
            });
        },
        [endpoint, emitAgent]
    );

    const getStack = useCallback(
        () => withCallback("getStack", stackName),
        [stackName, withCallback]
    );

    const deployStack = useCallback(
        (yaml: string, env: string, isAdd: boolean) =>
            withCallback("deployStack", stackName, yaml, env, isAdd),
        [stackName, withCallback]
    );

    const saveStack = useCallback(
        (yaml: string, env: string, isAdd: boolean) =>
            withCallback("saveStack", stackName, yaml, env, isAdd),
        [stackName, withCallback]
    );

    const startStack = useCallback(
        () => withCallback("startStack", stackName),
        [stackName, withCallback]
    );

    const stopStack = useCallback(
        () => withCallback("stopStack", stackName),
        [stackName, withCallback]
    );

    const restartStack = useCallback(
        () => withCallback("restartStack", stackName),
        [stackName, withCallback]
    );

    const downStack = useCallback(
        () => withCallback("downStack", stackName),
        [stackName, withCallback]
    );

    const updateStack = useCallback(
        () => withCallback("updateStack", stackName),
        [stackName, withCallback]
    );

    const deleteStack = useCallback(
        () => withCallback("deleteStack", stackName),
        [stackName, withCallback]
    );

    const startService = useCallback(
        (serviceName: string) => withCallback("startService", stackName, serviceName),
        [stackName, withCallback]
    );

    const stopService = useCallback(
        (serviceName: string) => withCallback("stopService", stackName, serviceName),
        [stackName, withCallback]
    );

    const restartService = useCallback(
        (serviceName: string) => withCallback("restartService", stackName, serviceName),
        [stackName, withCallback]
    );

    return {
        getStack,
        deployStack,
        saveStack,
        startStack,
        stopStack,
        restartStack,
        downStack,
        updateStack,
        deleteStack,
        startService,
        stopService,
        restartService,
    };
}
