import CodeMirror from "@uiw/react-codemirror";
import { yaml } from "@codemirror/lang-yaml";
import { tokyoNight } from "@uiw/codemirror-theme-tokyo-night";
import { useThemeStore } from "@/stores/theme-store";

interface YamlEditorProps {
    value: string;
    onChange: (value: string) => void;
    readOnly?: boolean;
}

export function YamlEditor({ value, onChange, readOnly = false }: YamlEditorProps) {
    const theme = useThemeStore((s) => s.theme);
    const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

    return (
        <div className="rounded-md border overflow-hidden">
            <CodeMirror
                value={value}
                onChange={onChange}
                extensions={[yaml()]}
                theme={isDark ? tokyoNight : undefined}
                readOnly={readOnly}
                height="500px"
                basicSetup={{
                    lineNumbers: true,
                    foldGutter: true,
                    bracketMatching: true,
                    indentOnInput: true,
                }}
            />
        </div>
    );
}
