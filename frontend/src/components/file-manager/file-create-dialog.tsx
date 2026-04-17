import { useState } from "react";
import {
    Dialog, DialogContent, DialogDescription,
    DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface FileCreateDialogProps {
    open: boolean;
    type: "file" | "dir";
    onOpenChange: (open: boolean) => void;
    onConfirm: (name: string) => void;
}

export function FileCreateDialog({ open, type, onOpenChange, onConfirm }: FileCreateDialogProps) {
    const [name, setName] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        onConfirm(name.trim());
        setName("");
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setName(""); }}>
            <DialogContent>
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>
                            New {type === "dir" ? "Folder" : "File"}
                        </DialogTitle>
                        <DialogDescription>
                            Enter a name for the new {type === "dir" ? "folder" : "file"}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={type === "dir" ? "folder-name" : "filename.txt"}
                            autoFocus
                        />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={!name.trim()}>
                            Create
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
