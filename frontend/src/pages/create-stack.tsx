import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { YamlEditor } from "@/components/stack/yaml-editor";
import { EnvEditor } from "@/components/stack/env-editor";
import { useStack } from "@/hooks/use-stack";
import { useSocketStore } from "@/stores/socket-store";
import { toast } from "sonner";
import { Rocket, Save, Terminal, ArrowRight, Loader2 } from "lucide-react";

const defaultYAML = `version: "3.8"
services:
  app:
    image: nginx:alpine
    ports:
      - "8080:80"
`;

const tabTrigger = "rounded-md px-4 text-[15px] font-medium text-muted-foreground transition-all hover:text-foreground data-active:bg-white data-active:text-foreground data-active:shadow-sm dark:data-active:bg-[#2e2e2b] dark:data-active:text-foreground";
const btnPrimary = "inline-flex items-center gap-2 rounded-md bg-[#1c1c1c] px-4 py-2 text-[14px] font-medium text-[#fcfbf8] shadow-inset-btn transition-colors hover:opacity-80 disabled:opacity-50 dark:bg-[#f7f4ed] dark:text-[#1c1c1c]";
const btnGhost = "inline-flex items-center gap-2 rounded-md border border-[rgba(28,28,28,0.4)] bg-transparent px-4 py-2 text-[14px] font-medium text-foreground transition-colors hover:opacity-80 disabled:opacity-50";

export function CreateStackPage() {
    const navigate = useNavigate();
    const [name, setName] = useState("");
    const [composeYAML, setComposeYAML] = useState(defaultYAML);
    const [composeENV, setComposeENV] = useState("");
    const [processing, setProcessing] = useState(false);

    const socket = useSocketStore((s) => s.socket);
    const stackOps = useStack(name);
    const [dockerRun, setDockerRun] = useState("");
    const [converting, setConverting] = useState(false);

    const handleConvert = () => {
        if (!dockerRun.trim() || !socket) return;
        setConverting(true);
        socket.emit(
            "composerize",
            dockerRun.trim(),
            (res: { ok: boolean; msg?: string; composeTemplate?: string }) => {
                setConverting(false);
                if (res.ok && res.composeTemplate) {
                    setComposeYAML(res.composeTemplate);
                    toast.success("Converted to Compose YAML");
                } else {
                    toast.error(res.msg ?? "Failed to convert");
                }
            }
        );
    };

    const handleDeploy = async () => {
        if (!name) { toast.error("Stack name is required"); return; }
        setProcessing(true);
        try {
            await stackOps.deployStack(composeYAML, composeENV, true);
            toast.success("Stack deployed");
            navigate(`/compose/${name}`);
        } finally {
            setProcessing(false);
        }
    };

    const handleSave = async () => {
        if (!name) { toast.error("Stack name is required"); return; }
        setProcessing(true);
        try {
            await stackOps.saveStack(composeYAML, composeENV, true);
            toast.success("Stack saved");
            navigate(`/compose/${name}`);
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div>
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="stack-name"
                    className="max-w-xs rounded-md border-border bg-background px-3 text-lg font-semibold text-foreground placeholder:text-muted-foreground"
                    autoFocus
                />
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 mb-6">
                <button onClick={handleDeploy} disabled={processing} className={btnPrimary}>
                    <Rocket className="h-4 w-4" /> Deploy
                </button>
                <button onClick={handleSave} disabled={processing} className={btnGhost}>
                    <Save className="h-4 w-4" /> Save Draft
                </button>
            </div>

            {/* Docker Run Converter */}
            <div className="mb-6 rounded-lg border border-border px-4 py-3">
                <div className="flex items-center gap-1.5 mb-2 text-[13px] font-medium text-muted-foreground">
                    <Terminal className="h-3.5 w-3.5" />
                    Convert from docker run
                </div>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={dockerRun}
                        onChange={(e) => setDockerRun(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleConvert(); }}
                        placeholder="docker run -d -p 8080:80 --name web nginx:alpine"
                        className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-[13px] text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-brand/30 focus:border-brand"
                    />
                    <button
                        onClick={handleConvert}
                        disabled={converting || !dockerRun.trim()}
                        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground shadow-inset-btn transition-colors hover:opacity-80 disabled:opacity-50"
                    >
                        {converting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                        Convert
                    </button>
                </div>
            </div>

            {/* Editor */}
            <Tabs defaultValue="yaml" className="gap-6">
                <TabsList className="group-data-horizontal/tabs:h-11 w-fit gap-1 rounded-lg bg-muted p-1">
                    <TabsTrigger value="yaml" className={tabTrigger}>YAML</TabsTrigger>
                    <TabsTrigger value="env" className={tabTrigger}>.env</TabsTrigger>
                </TabsList>

                <TabsContent value="yaml">
                    <YamlEditor value={composeYAML} onChange={setComposeYAML} readOnly={false} />
                </TabsContent>
                <TabsContent value="env">
                    <EnvEditor value={composeENV} onChange={setComposeENV} readOnly={false} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
