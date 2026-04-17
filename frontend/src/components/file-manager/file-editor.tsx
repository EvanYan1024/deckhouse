import { useState, useEffect, useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { yaml } from "@codemirror/lang-yaml";
import { json } from "@codemirror/lang-json";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { tokyoNight } from "@uiw/codemirror-theme-tokyo-night";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { useFileManager } from "@/hooks/use-file-manager";
import { useThemeStore } from "@/stores/theme-store";
import type { Extension } from "@codemirror/state";

const langExtensions: Record<string, () => Extension> = {
    ".yaml": yaml, ".yml": yaml,
    ".json": json,
    ".js": () => javascript(),
    ".ts": () => javascript({ typescript: true }),
    ".jsx": () => javascript({ jsx: true }),
    ".tsx": () => javascript({ jsx: true, typescript: true }),
    ".py": python,
    ".html": html, ".css": css,
};

interface FileEditorProps {
    filePath: string;
    stackName: string;
    endpoint: string;
    onClose: () => void;
    onSaved: () => void;
}

export function FileEditor({ filePath, stackName, endpoint, onClose, onSaved }: FileEditorProps) {
    const [content, setContent] = useState("");
    const [originalContent, setOriginalContent] = useState("");
    const [readOnly, setReadOnly] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    const themeMode = useThemeStore((s) => s.theme);
    const isDark = themeMode === "dark" || (themeMode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    const fm = useFileManager(stackName, endpoint);

    const fileName = filePath.split("/").pop() ?? "";
    const ext = fileName.includes(".") ? "." + fileName.split(".").pop()!.toLowerCase() : "";
    const modified = content !== originalContent;

    const extensions = useMemo(() => {
        const langFn = langExtensions[ext];
        return langFn ? [langFn()] : [];
    }, [ext]);

    useEffect(() => {
        setLoading(true);
        fm.readFile(filePath)
            .then((res) => {
                if (res.tooLarge) {
                    setReadOnly(true);
                    const mb = (res.size / (1024 * 1024)).toFixed(1);
                    setContent(`// File too large to edit inline (${mb} MB, limit 2 MB)\n// Use Download instead.`);
                } else if (res.readOnly) {
                    setReadOnly(true);
                    setContent("// File is read-only");
                } else if (res.encoding === "base64") {
                    setReadOnly(true);
                    setContent("// Binary file — cannot edit");
                } else {
                    setContent(res.content);
                    setOriginalContent(res.content);
                }
            })
            .catch((err) => setLoadError(err.message))
            .finally(() => setLoading(false));
    }, [filePath]);

    const handleSave = async () => {
        setSaving(true);
        try { await fm.writeFile(filePath, content); setOriginalContent(content); onSaved(); }
        finally { setSaving(false); }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "s") {
            e.preventDefault();
            if (modified && !saving && !readOnly) handleSave();
        }
    };

    if (loading) {
        return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-[#87867f]" /></div>;
    }

    if (loadError) {
        return (
            <div className="space-y-4">
                <p className="text-[14px] text-[#b53333]">Failed to load: {loadError}</p>
                <button onClick={onClose} className="inline-flex items-center gap-2 rounded-lg bg-[#e8e6dc] px-3 py-1.5 text-[14px] text-[#4d4c48] shadow-[0px_0px_0px_1px_#d1cfc5]">
                    <ArrowLeft className="h-4 w-4" /> Back
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3" onKeyDown={handleKeyDown}>
            <div className="flex items-center gap-2">
                <span className="font-mono text-[14px] truncate flex-1 text-[#5e5d59] dark:text-[#b0aea5]">{fileName}</span>
                {modified && (
                    <span className="rounded-full bg-[#c96442]/10 px-2 py-0.5 text-[11px] font-medium text-[#c96442]">
                        Modified
                    </span>
                )}
                {readOnly && (
                    <span className="rounded-full bg-[#f0eee6] px-2 py-0.5 text-[11px] font-medium text-[#87867f] dark:bg-[#30302e]">
                        Read Only
                    </span>
                )}
            </div>

            <div className="rounded-xl border border-[#e8e6dc] overflow-hidden dark:border-[#30302e]">
                <CodeMirror
                    value={content}
                    onChange={setContent}
                    extensions={extensions}
                    theme={isDark ? tokyoNight : undefined}
                    readOnly={readOnly}
                    height="500px"
                    basicSetup={{ lineNumbers: true, foldGutter: true, bracketMatching: true, indentOnInput: true }}
                />
            </div>

            <div className="flex justify-between">
                <button onClick={onClose} className="inline-flex items-center gap-2 rounded-lg bg-[#e8e6dc] px-3 py-1.5 text-[14px] text-[#4d4c48] shadow-[0px_0px_0px_1px_#d1cfc5] dark:bg-[#30302e] dark:text-[#b0aea5]">
                    <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <button
                    onClick={handleSave}
                    disabled={!modified || saving || readOnly}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#c96442] px-3 py-1.5 text-[14px] font-medium text-[#faf9f5] shadow-[0px_0px_0px_1px_#c96442] transition-colors hover:bg-[#b5573a] disabled:opacity-50"
                >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save
                </button>
            </div>
        </div>
    );
}
