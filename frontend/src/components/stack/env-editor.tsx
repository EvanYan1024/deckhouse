import CodeMirror from "@uiw/react-codemirror";
import { tokyoNight } from "@uiw/codemirror-theme-tokyo-night";
import { useThemeStore } from "@/stores/theme-store";

interface EnvEditorProps {
    value: string;
    onChange: (value: string) => void;
    readOnly?: boolean;
}

export function EnvEditor({ value, onChange, readOnly = false }: EnvEditorProps) {
    const theme = useThemeStore((s) => s.theme);
    const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

    return (
        <div className="rounded-md border overflow-hidden">
            <CodeMirror
                value={value}
                onChange={onChange}
                theme={isDark ? tokyoNight : undefined}
                readOnly={readOnly}
                height="300px"
                basicSetup={{
                    lineNumbers: true,
                    foldGutter: false,
                }}
            />
        </div>
    );
}
