import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { YamlEditor } from "@/components/stack/yaml-editor";
import { EnvEditor } from "@/components/stack/env-editor";
import { FileBrowser } from "@/components/file-manager/file-browser";
import { LogsView } from "@/components/stack/logs-view";
import { ContainerTerminal } from "@/components/stack/container-terminal";
import { ProgressTerminal } from "@/components/stack/progress-terminal";
import { ServiceList } from "@/components/stack/service-list";
import { NetworkList } from "@/components/stack/network-list";
import { useStack } from "@/hooks/use-stack";
import { useSocketStore } from "@/stores/socket-store";
import { toast } from "sonner";
import {
    Rocket, Save, Play, Square, RotateCcw, CloudDownload,
    Trash2, ArrowDown, Loader2, Pencil,
} from "lucide-react";

const tabTrigger = "rounded-md px-4 text-[15px] font-medium text-muted-foreground transition-all hover:text-foreground data-active:bg-white data-active:text-foreground data-active:shadow-sm dark:data-active:bg-[#2e2e2b] dark:data-active:text-foreground";
const btnPrimary = "inline-flex items-center gap-2 rounded-md bg-[#1c1c1c] px-4 py-2 text-[14px] font-medium text-[#fcfbf8] shadow-inset-btn transition-colors hover:opacity-80 disabled:opacity-50 dark:bg-[#f7f4ed] dark:text-[#1c1c1c]";
const btnGhost = "inline-flex items-center gap-2 rounded-md border border-[rgba(28,28,28,0.4)] bg-transparent px-4 py-2 text-[14px] font-medium text-foreground transition-colors hover:opacity-80 disabled:opacity-50";
const btnDanger = "inline-flex items-center gap-2 rounded-md bg-destructive/10 px-4 py-2 text-[14px] font-medium text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-50";

export function ComposePage() {
    const { stackName, endpoint: routeEndpoint } = useParams();
    const navigate = useNavigate();
    const endpoint = routeEndpoint ?? "";

    const [composeYAML, setComposeYAML] = useState("");
    const [composeENV, setComposeENV] = useState("");
    const [editMode, setEditMode] = useState(false);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [progressVisible, setProgressVisible] = useState(false);
    const [progressKey, setProgressKey] = useState(0);
    const [status, setStatus] = useState(0);

    const stackOps = useStack(stackName!, endpoint);
    const stackList = useSocketStore((s) => s.stackList);
    const authenticated = useSocketStore((s) => s.authenticated);

    const loadStack = useCallback(async () => {
        setLoading(true);
        try {
            const res = await stackOps.getStack();
            const stack = res.stack as Record<string, unknown>;
            setComposeYAML(String(stack.composeYAML ?? ""));
            setComposeENV(String(stack.composeENV ?? ""));
            setStatus(Number(stack.status ?? 0));
        } catch { /* toasted by hook */ }
        finally { setLoading(false); }
    }, [stackOps]);

    useEffect(() => {
        if (!authenticated) return;
        setEditMode(false);
        loadStack();
    }, [stackName, authenticated]);

    useEffect(() => {
        if (stackName && stackList[stackName]) setStatus(stackList[stackName].status);
    }, [stackList, stackName]);

    const isRunning = status === 3;

    const withProcessing = async (fn: () => Promise<unknown>, showProgress = true) => {
        setProcessing(true);
        if (showProgress) {
            setProgressVisible(true);
            setProgressKey((k) => k + 1);
        }
        try { await fn(); } finally { setProcessing(false); }
    };

    const handleDeploy = () => withProcessing(async () => {
        await stackOps.deployStack(composeYAML, composeENV, false);
        toast.success("Stack deployed");
        setEditMode(false);
        await loadStack();
    });

    const handleSave = () => withProcessing(async () => {
        await stackOps.saveStack(composeYAML, composeENV, false);
        toast.success("Stack saved");
    }, false);

    const handleStart = () => withProcessing(async () => { await stackOps.startStack(); toast.success("Started"); });
    const handleStop = () => withProcessing(async () => { await stackOps.stopStack(); toast.success("Stopped"); });
    const handleRestart = () => withProcessing(async () => { await stackOps.restartStack(); toast.success("Restarted"); });
    const handleUpdate = () => withProcessing(async () => { await stackOps.updateStack(); toast.success("Updated"); });
    const handleDown = () => withProcessing(async () => { await stackOps.downStack(); toast.success("Down"); });
    const handleDelete = () => withProcessing(async () => { await stackOps.deleteStack(); toast.success("Deleted"); navigate("/"); });

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-[#87867f]" />
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <h1 className="text-[2rem]">{stackName}</h1>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-medium ${
                    isRunning
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-muted text-muted-foreground"
                }`}>
                    {isRunning ? "Running" : status === 4 ? "Exited" : "Inactive"}
                </span>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2 mb-6">
                {editMode ? (
                    <>
                        <button onClick={handleDeploy} disabled={processing} className={btnPrimary}>
                            <Rocket className="h-4 w-4" /> Deploy
                        </button>
                        <button onClick={handleSave} disabled={processing} className={btnGhost}>
                            <Save className="h-4 w-4" /> Save Draft
                        </button>
                        <button onClick={() => { setEditMode(false); loadStack(); }} className={btnGhost}>
                            Cancel
                        </button>
                    </>
                ) : (
                    <>
                        <button onClick={() => setEditMode(true)} className={btnGhost}>
                            <Pencil className="h-4 w-4" /> Edit
                        </button>
                        {!isRunning && (
                            <button onClick={handleStart} disabled={processing} className={btnPrimary}>
                                <Play className="h-4 w-4" /> Start
                            </button>
                        )}
                        {isRunning && (
                            <>
                                <button onClick={handleRestart} disabled={processing} className={btnGhost}>
                                    <RotateCcw className="h-4 w-4" /> Restart
                                </button>
                                <button onClick={handleStop} disabled={processing} className={btnGhost}>
                                    <Square className="h-4 w-4" /> Stop
                                </button>
                            </>
                        )}
                        <button onClick={handleUpdate} disabled={processing} className={btnGhost}>
                            <CloudDownload className="h-4 w-4" /> Update
                        </button>
                        <button onClick={handleDown} disabled={processing} className={btnGhost}>
                            <ArrowDown className="h-4 w-4" /> Down
                        </button>
                        <AlertDialog>
                            <AlertDialogTrigger render={
                                <button disabled={processing} className={btnDanger}>
                                    <Trash2 className="h-4 w-4" /> Delete
                                </button>
                            } />
                            <AlertDialogContent className="rounded-xl border-border bg-background">
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Delete {stackName}?</AlertDialogTitle>
                                    <AlertDialogDescription className="text-muted-foreground">
                                        This will stop all containers and remove the stack directory.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-white hover:opacity-80">
                                        Delete
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </>
                )}
            </div>

            {/* Service list */}
            {!editMode && <ServiceList stackName={stackName!} endpoint={endpoint} />}

            {/* Progress */}
            {progressVisible && (
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[13px] font-medium text-muted-foreground">
                            {processing ? "Running..." : "Done"}
                        </span>
                        {!processing && (
                            <button
                                onClick={() => setProgressVisible(false)}
                                className="text-[12px] text-muted-foreground hover:text-foreground transition-colors"
                            >
                                Dismiss
                            </button>
                        )}
                    </div>
                    <ProgressTerminal stackName={stackName!} key={progressKey} />
                </div>
            )}

            {/* Tabs */}
            <Tabs defaultValue="yaml" className="gap-6">
                <TabsList className="group-data-horizontal/tabs:h-11 w-fit gap-1 rounded-lg bg-muted p-1">
                    <TabsTrigger value="yaml" className={tabTrigger}>YAML</TabsTrigger>
                    <TabsTrigger value="env" className={tabTrigger}>.env</TabsTrigger>
                    <TabsTrigger value="files" className={tabTrigger}>Files</TabsTrigger>
                    <TabsTrigger value="logs" className={tabTrigger}>Logs</TabsTrigger>
                    <TabsTrigger value="terminal" className={tabTrigger}>Terminal</TabsTrigger>
                </TabsList>

                <TabsContent value="yaml">
                    <YamlEditor value={composeYAML} onChange={setComposeYAML} readOnly={!editMode} />
                    <NetworkList endpoint={endpoint} />
                </TabsContent>
                <TabsContent value="env">
                    <EnvEditor value={composeENV} onChange={setComposeENV} readOnly={!editMode} />
                </TabsContent>
                <TabsContent value="files">
                    <FileBrowser stackName={stackName!} endpoint={endpoint} />
                </TabsContent>
                <TabsContent value="logs">
                    <LogsView stackName={stackName!} endpoint={endpoint} />
                </TabsContent>
                <TabsContent value="terminal">
                    <ContainerTerminal stackName={stackName!} endpoint={endpoint} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
