import { useRef, useState } from "react";
import {
    Dialog, DialogContent, DialogDescription,
    DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useSocketStore } from "@/stores/socket-store";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";

interface FileUploadDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    stackName: string;
    currentPath: string;
    endpoint: string;
    onUploaded: () => void;
}

export function FileUploadDialog({
    open, onOpenChange, stackName, currentPath, endpoint, onUploaded,
}: FileUploadDialogProps) {
    const emitAgent = useSocketStore((s) => s.emitAgent);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const handleUpload = async () => {
        if (!selectedFile) return;
        setUploading(true);

        const reader = new FileReader();
        reader.onload = () => {
            const base64 = (reader.result as string).split(",")[1];
            const filePath = currentPath
                ? `${stackName}/${currentPath}/${selectedFile.name}`
                : `${stackName}/${selectedFile.name}`;

            emitAgent(endpoint, "file:upload", filePath, base64, (res: Record<string, unknown>) => {
                setUploading(false);
                if (res.ok) {
                    toast.success(`Uploaded ${selectedFile.name}`);
                    setSelectedFile(null);
                    onOpenChange(false);
                    onUploaded();
                } else {
                    toast.error(String(res.msg ?? "Upload failed"));
                }
            });
        };
        reader.readAsDataURL(selectedFile);
    };

    return (
        <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setSelectedFile(null); }}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Upload File</DialogTitle>
                    <DialogDescription>
                        Select a file to upload (max 50MB).
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                    />
                    <div
                        className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 cursor-pointer hover:border-primary transition-colors"
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                            e.preventDefault();
                            setSelectedFile(e.dataTransfer.files[0] ?? null);
                        }}
                    >
                        <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                        {selectedFile ? (
                            <p className="text-sm font-medium">{selectedFile.name}</p>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                Click or drag file here
                            </p>
                        )}
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleUpload} disabled={!selectedFile || uploading}>
                        {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                        Upload
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
