import { Folder, File, FileText, FileImage, FileVideo, FileAudio, FileCode, Link2 } from "lucide-react";
import type { FileEntry } from "@/types/file";

const extIconMap: Record<string, typeof FileCode> = {
    ".yaml": FileCode, ".yml": FileCode, ".json": FileCode,
    ".js": FileCode, ".ts": FileCode, ".py": FileCode,
    ".go": FileCode, ".rs": FileCode, ".java": FileCode,
    ".html": FileCode, ".css": FileCode, ".sh": FileCode,
    ".sql": FileCode, ".dockerfile": FileCode,
    ".md": FileText, ".txt": FileText, ".log": FileText,
    ".conf": FileText, ".cfg": FileText, ".ini": FileText,
    ".env": FileText, ".toml": FileText, ".xml": FileText,
};

export function FileIcon({ entry }: { entry: FileEntry }) {
    if (entry.name === "..") {
        return <Folder className="h-4 w-4 text-muted-foreground" />;
    }
    if (entry.isSymlink) {
        return <Link2 className="h-4 w-4 text-blue-500" />;
    }
    if (entry.isDirectory) {
        return <Folder className="h-4 w-4 text-yellow-500" />;
    }

    switch (entry.type) {
        case "image": return <FileImage className="h-4 w-4 text-green-500" />;
        case "video": return <FileVideo className="h-4 w-4 text-purple-500" />;
        case "audio": return <FileAudio className="h-4 w-4 text-pink-500" />;
    }

    const Icon = extIconMap[entry.extension] ?? File;
    return <Icon className="h-4 w-4 text-muted-foreground" />;
}
