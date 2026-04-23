import { FilePlus, FolderPlus, Upload, RefreshCw, TerminalSquare } from "lucide-react";

interface FileToolbarProps {
    onNewFile: () => void;
    onNewDir: () => void;
    onUpload: () => void;
    onRefresh: () => void;
    onToggleTerminal?: () => void;
    terminalOpen?: boolean;
}

const btnSmall = "inline-flex items-center gap-1.5 rounded-lg bg-[#e8e6dc] px-2.5 py-1 text-[13px] font-medium text-[#4d4c48] shadow-[0px_0px_0px_1px_#d1cfc5] transition-colors hover:bg-[#dedc01]/10 dark:bg-[#30302e] dark:text-[#b0aea5] dark:shadow-[0px_0px_0px_1px_#5e5d59]";
const btnSmallActive = "inline-flex items-center gap-1.5 rounded-lg bg-[#c96442] px-2.5 py-1 text-[13px] font-medium text-[#faf9f5] shadow-[0px_0px_0px_1px_#c96442] transition-colors hover:bg-[#b75a3b]";

export function FileToolbar({ onNewFile, onNewDir, onUpload, onRefresh, onToggleTerminal, terminalOpen }: FileToolbarProps) {
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
            {onToggleTerminal && (
                <button onClick={onToggleTerminal} className={terminalOpen ? btnSmallActive : btnSmall}>
                    <TerminalSquare className="h-3.5 w-3.5" /> Terminal
                </button>
            )}
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
