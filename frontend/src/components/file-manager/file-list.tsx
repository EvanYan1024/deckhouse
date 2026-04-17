import { useState } from "react";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    ContextMenu, ContextMenuContent, ContextMenuItem,
    ContextMenuSeparator, ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { FileIcon } from "./file-icon";
import type { FileEntry } from "@/types/file";

interface FileListProps {
    entries: FileEntry[];
    loading: boolean;
    currentPath: string;
    onOpen: (entry: FileEntry) => void;
    onDelete: (entry: FileEntry) => void;
    onRename: (entry: FileEntry, newName: string) => void;
    onDownload: (entry: FileEntry) => void;
}

function formatSize(bytes: number): string {
    if (bytes === 0) return "-";
    const units = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

function formatDate(iso: string): string {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString(undefined, {
        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
}

export function FileList({
    entries, loading, currentPath, onOpen, onDelete, onRename, onDownload,
}: FileListProps) {
    const [deleteTarget, setDeleteTarget] = useState<FileEntry | null>(null);
    const [renameTarget, setRenameTarget] = useState<FileEntry | null>(null);
    const [renameName, setRenameName] = useState("");

    if (loading) {
        return (
            <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                ))}
            </div>
        );
    }

    const parentEntry: FileEntry | null = currentPath
        ? { name: "..", isDirectory: true, isSymlink: false, size: 0, modifiedAt: "", type: "directory", extension: "" }
        : null;

    const allEntries = parentEntry ? [parentEntry, ...entries] : entries;

    if (allEntries.length === 0) {
        return <p className="py-8 text-center text-sm text-muted-foreground">Empty directory</p>;
    }

    return (
        <>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[50%]">Name</TableHead>
                        <TableHead className="w-[25%]">Size</TableHead>
                        <TableHead className="w-[25%]">Modified</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {allEntries.map((entry) => (
                        <ContextMenu key={entry.name}>
                            <ContextMenuTrigger
                                render={<TableRow className="cursor-pointer" onDoubleClick={() => onOpen(entry)} />}
                            >
                                <TableCell className="flex items-center gap-2">
                                    <FileIcon entry={entry} />
                                    <span className="truncate">{entry.name}</span>
                                </TableCell>
                                <TableCell className="text-muted-foreground text-xs">
                                    {entry.isDirectory ? "-" : formatSize(entry.size)}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-xs">
                                    {formatDate(entry.modifiedAt)}
                                </TableCell>
                            </ContextMenuTrigger>
                            {entry.name !== ".." && (
                                <ContextMenuContent>
                                    <ContextMenuItem onClick={() => onOpen(entry)}>Open</ContextMenuItem>
                                    {!entry.isDirectory && (
                                        <ContextMenuItem onClick={() => onDownload(entry)}>Download</ContextMenuItem>
                                    )}
                                    <ContextMenuSeparator />
                                    <ContextMenuItem onClick={() => {
                                        setRenameTarget(entry);
                                        setRenameName(entry.name);
                                    }}>
                                        Rename
                                    </ContextMenuItem>
                                    <ContextMenuItem
                                        className="text-destructive"
                                        onClick={() => setDeleteTarget(entry)}
                                    >
                                        Delete
                                    </ContextMenuItem>
                                </ContextMenuContent>
                            )}
                        </ContextMenu>
                    ))}
                </TableBody>
            </Table>

            {/* Delete dialog */}
            <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {deleteTarget?.isDirectory
                                ? "This will permanently delete the directory and all its contents."
                                : "This will permanently delete the file."}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => { if (deleteTarget) onDelete(deleteTarget); setDeleteTarget(null); }}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Rename dialog */}
            <Dialog open={!!renameTarget} onOpenChange={(open) => { if (!open) setRenameTarget(null); }}>
                <DialogContent>
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        if (renameTarget && renameName && renameName !== renameTarget.name) {
                            onRename(renameTarget, renameName);
                        }
                        setRenameTarget(null);
                    }}>
                        <DialogHeader>
                            <DialogTitle>Rename {renameTarget?.name}</DialogTitle>
                        </DialogHeader>
                        <div className="py-4">
                            <Input
                                value={renameName}
                                onChange={(e) => setRenameName(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setRenameTarget(null)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={!renameName || renameName === renameTarget?.name}>
                                Rename
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
