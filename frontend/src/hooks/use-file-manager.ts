import { useState, useCallback } from "react";
import { useSocketStore } from "@/stores/socket-store";
import type { FileEntry, FileContent } from "@/types/file";
import { toast } from "sonner";

/**
 * `rootPath` is the server-side prefix for list operations. For a stack it's
 * the bare stack name; for a volume it's `@vol/<stackName>/<urlencodedSource>`.
 * Read / write / create / delete / rename / download all take a full path
 * built by the caller, so they don't consult `rootPath` directly.
 */
export function useFileManager(rootPath: string, endpoint: string) {
    const emitAgent = useSocketStore((s) => s.emitAgent);
    const [entries, setEntries] = useState<FileEntry[]>([]);
    const [loading, setLoading] = useState(false);

    const listDir = useCallback((relativePath: string) => {
        setLoading(true);
        const dirPath = relativePath
            ? `${rootPath}/${relativePath}`
            : rootPath;

        emitAgent(endpoint, "file:listDir", dirPath, (res: Record<string, unknown>) => {
            setLoading(false);
            if (res.ok) {
                setEntries(res.entries as FileEntry[]);
            } else {
                toast.error(String(res.msg ?? "Failed to list directory"));
            }
        });
    }, [rootPath, endpoint, emitAgent]);

    const readFile = useCallback((filePath: string): Promise<FileContent> => {
        return new Promise((resolve, reject) => {
            emitAgent(endpoint, "file:read", filePath, (res: Record<string, unknown>) => {
                if (res.ok) {
                    resolve(res as unknown as FileContent);
                } else {
                    reject(new Error(String(res.msg)));
                }
            });
        });
    }, [endpoint, emitAgent]);

    const writeFile = useCallback((filePath: string, content: string): Promise<void> => {
        return new Promise((resolve, reject) => {
            emitAgent(endpoint, "file:write", filePath, content, (res: Record<string, unknown>) => {
                if (res.ok) {
                    toast.success("File saved");
                    resolve();
                } else {
                    toast.error(String(res.msg ?? "Failed to save"));
                    reject(new Error(String(res.msg)));
                }
            });
        });
    }, [endpoint, emitAgent]);

    const createDir = useCallback((dirPath: string): Promise<void> => {
        return new Promise((resolve, reject) => {
            emitAgent(endpoint, "file:createDir", dirPath, (res: Record<string, unknown>) => {
                res.ok ? resolve() : reject(new Error(String(res.msg)));
            });
        });
    }, [endpoint, emitAgent]);

    const createFile = useCallback((filePath: string): Promise<void> => {
        return new Promise((resolve, reject) => {
            emitAgent(endpoint, "file:createFile", filePath, (res: Record<string, unknown>) => {
                res.ok ? resolve() : reject(new Error(String(res.msg)));
            });
        });
    }, [endpoint, emitAgent]);

    const deleteItem = useCallback((itemPath: string): Promise<void> => {
        return new Promise((resolve, reject) => {
            emitAgent(endpoint, "file:delete", itemPath, (res: Record<string, unknown>) => {
                if (res.ok) { toast.success("Deleted"); resolve(); }
                else { toast.error(String(res.msg ?? "Failed to delete")); reject(new Error(String(res.msg))); }
            });
        });
    }, [endpoint, emitAgent]);

    const renameItem = useCallback((itemPath: string, newName: string): Promise<void> => {
        return new Promise((resolve, reject) => {
            emitAgent(endpoint, "file:rename", itemPath, newName, (res: Record<string, unknown>) => {
                if (res.ok) { toast.success("Renamed"); resolve(); }
                else { toast.error(String(res.msg ?? "Failed to rename")); reject(new Error(String(res.msg))); }
            });
        });
    }, [endpoint, emitAgent]);

    const downloadFile = useCallback((filePath: string) => {
        emitAgent(endpoint, "file:download", filePath, (res: Record<string, unknown>) => {
            if (!res.ok) { toast.error(String(res.msg ?? "Download failed")); return; }
            const bytes = Uint8Array.from(atob(res.content as string), (c) => c.charCodeAt(0));
            const blob = new Blob([bytes]);
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = res.name as string;
            a.click();
            URL.revokeObjectURL(url);
        });
    }, [endpoint, emitAgent]);

    return {
        entries, loading,
        listDir, readFile, writeFile,
        createDir, createFile, deleteItem, renameItem,
        downloadFile,
    };
}
