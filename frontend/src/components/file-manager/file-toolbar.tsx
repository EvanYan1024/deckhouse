import { FilePlus, FolderPlus, Upload, RefreshCw } from "lucide-react";

interface FileToolbarProps {
    onNewFile: () => void;
    onNewDir: () => void;
    onUpload: () => void;
    onRefresh: () => void;
}

const btnSmall = "inline-flex items-center gap-1.5 rounded-lg bg-[#e8e6dc] px-2.5 py-1 text-[13px] font-medium text-[#4d4c48] shadow-[0px_0px_0px_1px_#d1cfc5] transition-colors hover:bg-[#dedc01]/10 dark:bg-[#30302e] dark:text-[#b0aea5] dark:shadow-[0px_0px_0px_1px_#5e5d59]";

export function FileToolbar({ onNewFile, onNewDir, onUpload, onRefresh }: FileToolbarProps) {
    return (
        <div className="flex gap-1.5">
            <button onClick={onNewFile} className={btnSmall}>
                <FilePlus className="h-3.5 w-3.5" /> File
            </button>
            <button onClick={onNewDir} className={btnSmall}>
                <FolderPlus className="h-3.5 w-3.5" /> Folder
            </button>
            <button onClick={onUpload} className={btnSmall}>
                <Upload className="h-3.5 w-3.5" /> Upload
            </button>
            <div className="flex-1" />
            <button
                onClick={onRefresh}
                className="rounded-lg p-1.5 text-[#87867f] transition-colors hover:bg-[#f0eee6] hover:text-[#4d4c48] dark:hover:bg-[#30302e]"
            >
                <RefreshCw className="h-3.5 w-3.5" />
            </button>
        </div>
    );
}
