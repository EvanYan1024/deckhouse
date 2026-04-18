import path from "path";
import fs from "fs";
import fsAsync from "fs/promises";
import childProcess from "child_process";
import YAML from "yaml";
import type { DeckouseServer } from "./deckhouse-server";
import { ValidationError } from "./util-server";

// Status constants
export const UNKNOWN = 0;
export const CREATED_FILE = 1;
export const CREATED_STACK = 2;
export const RUNNING = 3;
export const EXITED = 4;

const acceptedComposeFileNames = [
    "compose.yaml",
    "compose.yml",
    "docker-compose.yaml",
    "docker-compose.yml",
];

export interface VolumeInfo {
    serviceName: string;
    source: string;         // as declared in compose (./data, /opt/x, ~/foo)
    target: string;         // container mount path
    resolvedSource: string; // absolute host path
    type: "bind";
    isStackLocal: boolean;  // resolvedSource lives under server.stacksDir
}

export class Stack {
    name: string;
    protected _status: number = UNKNOWN;
    protected _composeYAML?: string;
    protected _composeENV?: string;
    protected _composeFileName: string = "compose.yaml";
    protected server: DeckouseServer;

    constructor(
        server: DeckouseServer,
        name: string,
        composeYAML?: string,
        composeENV?: string,
    ) {
        this.server = server;
        this.name = name;
        this._composeYAML = composeYAML;
        this._composeENV = composeENV;
    }

    // --- Path helpers ---

    get path(): string {
        return path.join(this.server.stacksDir, this.name);
    }

    get composeFilePath(): string {
        return path.join(this.path, this._composeFileName);
    }

    get envFilePath(): string {
        return path.join(this.path, ".env");
    }

    // --- Lazy-loaded content ---

    get composeYAML(): string {
        if (this._composeYAML === undefined) {
            // An absent compose file is legitimate (new stack before first save);
            // permission / IO errors must propagate so the user notices, not be
            // masked as an empty editor that could overwrite real content.
            this._composeYAML = fs.existsSync(this.composeFilePath)
                ? fs.readFileSync(this.composeFilePath, "utf-8")
                : "";
        }
        return this._composeYAML;
    }

    set composeYAML(value: string) {
        this._composeYAML = value;
    }

    get composeENV(): string {
        if (this._composeENV === undefined) {
            this._composeENV = fs.existsSync(this.envFilePath)
                ? fs.readFileSync(this.envFilePath, "utf-8")
                : "";
        }
        return this._composeENV;
    }

    set composeENV(value: string) {
        this._composeENV = value;
    }

    get isManagedByDockge(): boolean {
        return fs.existsSync(this.composeFilePath);
    }

    get status(): number {
        return this._status;
    }

    set status(value: number) {
        this._status = value;
    }

    // --- Validation ---

    static validateName(name: string) {
        if (typeof name !== "string" || !/^[a-z0-9][a-z0-9_-]*$/.test(name)) {
            throw new ValidationError(
                "Stack name must start with a letter/digit and contain only a-z, 0-9, -, _"
            );
        }
    }

    // Matches docker compose service name rules and blocks argument-injection
    // attempts where serviceName could start with `-` and be parsed as a flag.
    static validateServiceName(name: string) {
        if (typeof name !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(name)) {
            throw new ValidationError(
                "Service name must start with a letter/digit and contain only alphanumerics, -, _, ."
            );
        }
    }

    validate() {
        Stack.validateName(this.name);

        // Validate YAML syntax
        if (this._composeYAML) {
            try {
                YAML.parse(this._composeYAML);
            } catch (e) {
                throw new ValidationError(
                    `Invalid YAML: ${e instanceof Error ? e.message : String(e)}`
                );
            }
        }
    }

    // --- File operations ---

    async save(isAdd: boolean) {
        this.validate();

        const dir = this.path;
        if (isAdd) {
            if (fs.existsSync(dir)) {
                throw new ValidationError("Stack already exists");
            }
            await fsAsync.mkdir(dir, { recursive: true });
        }

        // Write compose file
        if (this._composeYAML !== undefined) {
            await fsAsync.writeFile(this.composeFilePath, this._composeYAML, "utf-8");
        }

        // Write .env file — if the user cleared it, remove the old file so the
        // next deploy doesn't silently keep stale values
        if (this._composeENV !== undefined) {
            if (this._composeENV === "") {
                await fsAsync.rm(this.envFilePath, { force: true });
            } else {
                await fsAsync.writeFile(this.envFilePath, this._composeENV, "utf-8");
            }
        }
    }

    // --- Docker Compose operations ---

    private composeArgs(subCommand: string): string[] {
        const args = [
            "compose",
            "-f",
            this.composeFilePath,
            "--project-directory",
            this.path,
        ];

        // Include global.env if exists
        const globalEnvPath = path.join(this.server.stacksDir, "global.env");
        if (fs.existsSync(globalEnvPath)) {
            args.push("--env-file", globalEnvPath);
        }

        // Include stack-level .env if exists
        if (fs.existsSync(this.envFilePath)) {
            args.push("--env-file", this.envFilePath);
        }

        args.push(...subCommand.split(" "));
        return args;
    }

    private exec(subCommand: string, onProgress?: (data: string) => void): Promise<string> {
        return new Promise((resolve, reject) => {
            const args = this.composeArgs(subCommand);
            const child = childProcess.spawn("docker", args, {
                cwd: this.path,
                stdio: ["ignore", "pipe", "pipe"],
            });

            let output = "";
            const onData = (data: Buffer) => {
                const text = data.toString();
                output += text;
                onProgress?.(text);
            };

            child.stdout?.on("data", onData);
            child.stderr?.on("data", onData);

            child.on("close", (code) => {
                if (code === 0) resolve(output);
                else reject(new Error(output || `Command exited with code ${code}`));
            });

            child.on("error", reject);
        });
    }

    async deploy(onProgress?: (data: string) => void) {
        await this.save(false);
        await this.exec("up -d --remove-orphans", onProgress);
        this._status = RUNNING;
    }

    async start(onProgress?: (data: string) => void) {
        await this.exec("up -d --remove-orphans", onProgress);
        this._status = RUNNING;
    }

    async stop(onProgress?: (data: string) => void) {
        await this.exec("stop", onProgress);
        this._status = EXITED;
    }

    async restart(onProgress?: (data: string) => void) {
        await this.exec("restart", onProgress);
        this._status = RUNNING;
    }

    async down(onProgress?: (data: string) => void) {
        await this.exec("down", onProgress);
        this._status = EXITED;
    }

    async update(onProgress?: (data: string) => void) {
        await this.exec("pull", onProgress);
        await this.exec("up -d --remove-orphans", onProgress);
        this._status = RUNNING;
    }

    async delete(onProgress?: (data: string) => void) {
        // Best-effort bring-down: a stack with no running containers will make
        // `compose down` exit non-zero, and we still want the delete to proceed.
        // Log the error instead of swallowing it silently.
        try {
            await this.exec("down", onProgress);
        } catch (e) {
            console.warn(`[stack ${this.name}] down failed during delete:`, e instanceof Error ? e.message : e);
        }

        await fsAsync.rm(this.path, { recursive: true, force: true });
    }

    // --- Per-service operations ---

    async startService(serviceName: string, onProgress?: (data: string) => void) {
        Stack.validateServiceName(serviceName);
        await this.exec(`up -d ${serviceName}`, onProgress);
    }

    async stopService(serviceName: string, onProgress?: (data: string) => void) {
        Stack.validateServiceName(serviceName);
        await this.exec(`stop ${serviceName}`, onProgress);
    }

    async restartService(serviceName: string, onProgress?: (data: string) => void) {
        Stack.validateServiceName(serviceName);
        await this.exec(`restart ${serviceName}`, onProgress);
    }

    // --- Status ---

    async updateStatus() {
        try {
            const output = await this.exec("ps --format json");
            const lines = output.trim().split("\n").filter(Boolean);
            if (lines.length === 0) {
                this._status = fs.existsSync(this.composeFilePath) ? CREATED_FILE : UNKNOWN;
                return;
            }

            let allExited = true;
            for (const line of lines) {
                try {
                    const container = JSON.parse(line);
                    if (container.State === "running") {
                        this._status = RUNNING;
                        return;
                    }
                    if (container.State !== "exited") {
                        allExited = false;
                    }
                } catch {
                    // skip invalid JSON lines
                }
            }
            this._status = allExited ? EXITED : CREATED_STACK;
        } catch {
            this._status = fs.existsSync(this.composeFilePath) ? CREATED_FILE : UNKNOWN;
        }
    }

    /**
     * Parse compose YAML and return every bind-mount declared by any service.
     * Named volumes (top-level `volumes:` entries, or sources that aren't
     * filesystem paths) are skipped — resolving them would require
     * `docker volume inspect` and mounting /var/lib/docker/volumes into the
     * Deckhouse container, which is out of scope for v1.
     */
    async getVolumes(): Promise<VolumeInfo[]> {
        if (!this.composeYAML) return [];

        let parsed: unknown;
        try {
            parsed = YAML.parse(this.composeYAML);
        } catch (e) {
            throw new ValidationError(
                `Invalid YAML: ${e instanceof Error ? e.message : String(e)}`
            );
        }

        if (!parsed || typeof parsed !== "object") return [];
        const root = parsed as Record<string, unknown>;

        const services = root.services;
        if (!services || typeof services !== "object") return [];

        // Anything declared at the top level is a named volume; skip those
        // references when we encounter them in service volume lists.
        const topLevelVolumes = new Set<string>();
        if (root.volumes && typeof root.volumes === "object") {
            for (const key of Object.keys(root.volumes as object)) {
                topLevelVolumes.add(key);
            }
        }

        const result: VolumeInfo[] = [];

        for (const [serviceName, service] of Object.entries(services)) {
            if (!service || typeof service !== "object") continue;
            const vols = (service as Record<string, unknown>).volumes;
            if (!Array.isArray(vols)) continue;

            for (const v of vols) {
                const parsedVol = this.parseVolumeEntry(v);
                if (!parsedVol) continue;
                const { source, target } = parsedVol;

                // Named volume reference (declared at top level) — skip
                if (topLevelVolumes.has(source)) continue;

                // A bind source is a filesystem path. Anything else (bare
                // identifier) is an undeclared name and would fail at runtime
                // anyway — skip it rather than misclassify as bind.
                if (!Stack.looksLikeBindPath(source)) continue;

                const resolvedSource = this.resolveBindSource(source);
                if (!resolvedSource) continue;

                const stacksDir = this.server.stacksDir;
                const isStackLocal =
                    resolvedSource === stacksDir ||
                    resolvedSource.startsWith(stacksDir + path.sep);

                result.push({
                    serviceName,
                    source,
                    target,
                    resolvedSource,
                    type: "bind",
                    isStackLocal,
                });
            }
        }

        return result;
    }

    private parseVolumeEntry(v: unknown): { source: string; target: string } | null {
        if (typeof v === "string") {
            // short syntax: "src:dst[:mode]". A single segment is an anonymous
            // in-container volume with no host path, nothing to browse.
            const parts = v.split(":");
            if (parts.length < 2) return null;
            const source = parts[0];
            const target = parts[1];
            if (!source || !target) return null;
            return { source, target };
        }
        if (v && typeof v === "object") {
            const obj = v as Record<string, unknown>;
            if (obj.type !== undefined && obj.type !== "bind") return null;
            const source = obj.source;
            const target = obj.target;
            if (typeof source !== "string" || typeof target !== "string") return null;
            if (!source || !target) return null;
            return { source, target };
        }
        return null;
    }

    private static looksLikeBindPath(source: string): boolean {
        return (
            source.startsWith("/") ||
            source.startsWith("./") ||
            source.startsWith("../") ||
            source === "." ||
            source === ".." ||
            source.startsWith("~")
        );
    }

    private resolveBindSource(source: string): string | null {
        if (source.startsWith("~")) {
            const home = process.env.HOME;
            if (!home) return null;
            return path.resolve(home + source.slice(1));
        }
        if (source.startsWith("/")) {
            return path.resolve(source);
        }
        // Relative sources resolve against the compose-file directory, which
        // for Deckhouse is always the stack directory.
        return path.resolve(this.path, source);
    }

    async getServiceStatusList(): Promise<Record<string, unknown>[]> {
        try {
            const output = await this.exec("ps --format json");
            const results: Record<string, unknown>[] = [];
            for (const line of output.trim().split("\n")) {
                try {
                    results.push(JSON.parse(line));
                } catch {
                    // skip
                }
            }
            return results;
        } catch {
            return [];
        }
    }

    // --- JSON serialization ---

    toJSON(endpoint: string = "") {
        return {
            name: this.name,
            status: this._status,
            composeYAML: this.composeYAML,
            composeENV: this.composeENV,
            composeFileName: this._composeFileName,
            isManagedByDockge: this.isManagedByDockge,
            endpoint,
        };
    }

    toSimpleJSON(endpoint: string = "") {
        return {
            name: this.name,
            status: this._status,
            isManagedByDockge: this.isManagedByDockge,
            tags: [],
            endpoint,
        };
    }

    // --- Static methods ---

    static async getStack(server: DeckouseServer, name: string): Promise<Stack> {
        // Reject traversal attempts like "../etc" before they reach fs operations
        Stack.validateName(name);

        const stack = new Stack(server, name);
        const dir = stack.path;

        if (!fs.existsSync(dir)) {
            throw new ValidationError(`Stack "${name}" not found`);
        }

        // Detect compose filename
        for (const fn of acceptedComposeFileNames) {
            if (fs.existsSync(path.join(dir, fn))) {
                stack._composeFileName = fn;
                break;
            }
        }

        await stack.updateStatus();
        return stack;
    }

    static async getStackList(
        server: DeckouseServer
    ): Promise<Record<string, ReturnType<Stack["toSimpleJSON"]>>> {
        const stacksDir = server.stacksDir;
        const result: Record<string, ReturnType<Stack["toSimpleJSON"]>> = {};

        if (!fs.existsSync(stacksDir)) {
            return result;
        }

        const entries = await fsAsync.readdir(stacksDir, { withFileTypes: true });
        const candidates: string[] = [];

        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            if (entry.name.startsWith(".")) continue;

            const hasCompose = acceptedComposeFileNames.some((fn) =>
                fs.existsSync(path.join(stacksDir, entry.name, fn))
            );
            if (hasCompose) candidates.push(entry.name);
        }

        // Each getStack() shells out to `docker compose ps`; running them in
        // parallel turns an O(N) serial wait into a single round-trip.
        const settled = await Promise.allSettled(
            candidates.map((name) => Stack.getStack(server, name))
        );
        for (let i = 0; i < settled.length; i++) {
            const r = settled[i];
            if (r.status === "fulfilled") {
                result[candidates[i]] = r.value.toSimpleJSON();
            }
            // Rejected stacks are skipped — matches prior behavior
        }

        return result;
    }
}
