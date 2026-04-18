import { useState, useEffect, useMemo } from "react";
import { useSocketStore } from "@/stores/socket-store";
import { useFileManager } from "@/hooks/use-file-manager";
import { useStackVolumes } from "@/hooks/use-stack-volumes";
import { FileBreadcrumb } from "./file-breadcrumb";
import { FileToolbar } from "./file-toolbar";
import { FileList } from "./file-list";
import { FileEditor } from "./file-editor";
import { FileCreateDialog } from "./file-create-dialog";
import { FileUploadDialog } from "./file-upload-dialog";
import type { FileEntry, VolumeInfo } from "@/types/file";
import { ArrowLeft, FolderOpen } from "lucide-react";

interface FileBrowserProps {
    stackName: string;
    endpoint: string;
}

type View = "stack" | "volumes";

export function FileBrowser({ stackName, endpoint }: FileBrowserProps) {
    const [view, setView] = useState<View>("stack");
    const [activeVolume, setActiveVolume] = useState<VolumeInfo | null>(null);
    const [currentPath, setCurrentPath] = useState("");
    const [editingFile, setEditingFile] = useState<string | null>(null);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [createType, setCreateType] = useState<"file" | "dir">("file");
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

    const authenticated = useSocketStore((s) => s.authenticated);
    const { volumes, refresh: refreshVolumes } = useStackVolumes(stackName, endpoint);

    // For the stack view, rootPath is the stack name — backward-compatible with
    // the pre-volume behavior. For a selected volume, we emit the sentinel
    // `@vol/<stackName>/<encoded-source>` that the server resolves to the
    // volume's host path (see backend resolveFileContext).
    const rootPath = useMemo(() => {
        if (view === "volumes" && activeVolume) {
            return `@vol/${stackName}/${encodeURIComponent(activeVolume.source)}`;
        }
        return stackName;
    }, [view, activeVolume, stackName]);

    const fm = useFileManager(rootPath, endpoint);
    const inBrowser = view === "stack" || !!activeVolume;

    useEffect(() => {
        if (!authenticated) return;
        if (!inBrowser) return;
        fm.listDir(currentPath);
    }, [rootPath, currentPath, authenticated, inBrowser]);

    const buildFullPath = (entryName: string) => {
        return currentPath
            ? `${rootPath}/${currentPath}/${entryName}`
            : `${rootPath}/${entryName}`;
    };

    const navigateTo = (path: string) => {
        setCurrentPath(path);
        setEditingFile(null);
    };

    const handleOpen = (entry: FileEntry) => {
        if (entry.name === "..") {
            const parts = currentPath.split("/").filter(Boolean);
            parts.pop();
            navigateTo(parts.join("/"));
            return;
        }
        if (entry.isDirectory) {
            navigateTo(currentPath ? `${currentPath}/${entry.name}` : entry.name);
        } else if (entry.type === "text") {
            setEditingFile(buildFullPath(entry.name));
        } else {
            fm.downloadFile(buildFullPath(entry.name));
        }
    };

    const openVolume = (v: VolumeInfo) => {
        setActiveVolume(v);
        setCurrentPath("");
        setEditingFile(null);
    };

    const backToVolumeList = () => {
        setActiveVolume(null);
        setCurrentPath("");
        setEditingFile(null);
        refreshVolumes();
    };

    const switchView = (next: View) => {
        setView(next);
        setActiveVolume(null);
        setCurrentPath("");
        setEditingFile(null);
        if (next === "volumes") refreshVolumes();
    };

    if (editingFile) {
        return (
            <FileEditor
                filePath={editingFile}
                rootPath={rootPath}
                endpoint={endpoint}
                onClose={() => setEditingFile(null)}
                onSaved={() => fm.listDir(currentPath)}
            />
        );
    }

    const tabInactive = "rounded-md px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground";
    const tabActive = "rounded-md px-3 py-1.5 text-[13px] font-medium bg-muted text-foreground";

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center gap-1 border-b border-border pb-2">
                <button onClick={() => switchView("stack")} className={view === "stack" ? tabActive : tabInactive}>
                    Stack Files
                </button>
                <button onClick={() => switchView("volumes")} className={view === "volumes" ? tabActive : tabInactive}>
                    Volumes{volumes.length > 0 ? ` (${volumes.length})` : ""}
                </button>
            </div>

            {view === "volumes" && !activeVolume && (
                <div className="space-y-2">
                    {volumes.length === 0 ? (
                        <p className="py-8 text-center text-sm text-muted-foreground">
                            No bind-mount volumes declared in this stack.
                        </p>
                    ) : volumes.map((v) => (
                        <button
                            key={`${v.serviceName}:${v.source}:${v.target}`}
                            onClick={() => openVolume(v)}
                            className="w-full flex items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted"
                        >
                            <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-[14px] font-medium">{v.serviceName}</span>
                                    {v.isStackLocal && (
                                        <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                                            stack-local
                                        </span>
                                    )}
                                </div>
                                <div className="text-[12px] text-muted-foreground truncate font-mono mt-0.5">
                                    {v.source} → {v.target}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {inBrowser && (
                <>
                    {view === "volumes" && activeVolume && (
                        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                            <button onClick={backToVolumeList} className="inline-flex items-center gap-1 transition-colors hover:text-foreground">
                                <ArrowLeft className="h-3.5 w-3.5" />
                                Volumes
                            </button>
                            <span>·</span>
                            <span className="font-mono truncate">{activeVolume.source}</span>
                        </div>
                    )}

                    <FileBreadcrumb path={currentPath} onNavigate={navigateTo} />

                    <FileToolbar
                        onNewFile={() => { setCreateType("file"); setCreateDialogOpen(true); }}
                        onNewDir={() => { setCreateType("dir"); setCreateDialogOpen(true); }}
                        onUpload={() => setUploadDialogOpen(true)}
                        onRefresh={() => fm.listDir(currentPath)}
                    />

                    <FileList
                        entries={fm.entries}
                        loading={fm.loading}
                        currentPath={currentPath}
                        onOpen={handleOpen}
                        onDelete={async (entry) => {
                            await fm.deleteItem(buildFullPath(entry.name));
                            fm.listDir(currentPath);
                        }}
                        onRename={async (entry, newName) => {
                            await fm.renameItem(buildFullPath(entry.name), newName);
                            fm.listDir(currentPath);
                        }}
                        onDownload={(entry) => fm.downloadFile(buildFullPath(entry.name))}
                    />

                    <FileCreateDialog
                        open={createDialogOpen}
                        type={createType}
                        onOpenChange={setCreateDialogOpen}
                        onConfirm={async (name) => {
                            const fullPath = buildFullPath(name);
                            if (createType === "dir") {
                                await fm.createDir(fullPath);
                            } else {
                                await fm.createFile(fullPath);
                            }
                            fm.listDir(currentPath);
                        }}
                    />

                    <FileUploadDialog
                        open={uploadDialogOpen}
                        onOpenChange={setUploadDialogOpen}
                        rootPath={rootPath}
                        currentPath={currentPath}
                        endpoint={endpoint}
                        onUploaded={() => fm.listDir(currentPath)}
                    />
                </>
            )}
        </div>
    );
}
