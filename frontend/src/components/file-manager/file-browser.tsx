import { useState, useEffect } from "react";
import { useSocketStore } from "@/stores/socket-store";
import { useFileManager } from "@/hooks/use-file-manager";
import { FileBreadcrumb } from "./file-breadcrumb";
import { FileToolbar } from "./file-toolbar";
import { FileList } from "./file-list";
import { FileEditor } from "./file-editor";
import { FileCreateDialog } from "./file-create-dialog";
import { FileUploadDialog } from "./file-upload-dialog";
import type { FileEntry } from "@/types/file";

interface FileBrowserProps {
    stackName: string;
    endpoint: string;
}

export function FileBrowser({ stackName, endpoint }: FileBrowserProps) {
    const [currentPath, setCurrentPath] = useState("");
    const [editingFile, setEditingFile] = useState<string | null>(null);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [createType, setCreateType] = useState<"file" | "dir">("file");
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

    const fm = useFileManager(stackName, endpoint);
    const authenticated = useSocketStore((s) => s.authenticated);

    useEffect(() => {
        if (!authenticated) return;
        fm.listDir(currentPath);
    }, [currentPath, stackName, authenticated]);

    const navigateTo = (path: string) => {
        setCurrentPath(path);
        setEditingFile(null);
    };

    const buildFullPath = (entryName: string) => {
        return currentPath
            ? `${stackName}/${currentPath}/${entryName}`
            : `${stackName}/${entryName}`;
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

    if (editingFile) {
        return (
            <FileEditor
                filePath={editingFile}
                stackName={stackName}
                endpoint={endpoint}
                onClose={() => setEditingFile(null)}
                onSaved={() => fm.listDir(currentPath)}
            />
        );
    }

    return (
        <div className="flex flex-col gap-3">
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
                stackName={stackName}
                currentPath={currentPath}
                endpoint={endpoint}
                onUploaded={() => fm.listDir(currentPath)}
            />
        </div>
    );
}
