// Shared types used by both backend and frontend

export interface StackInfo {
    name: string;
    status: number;
    tags: string[];
    isManagedByDockge: boolean;
    composeYAML: string;
    composeENV: string;
    endpoint: string;
}

export interface FileEntry {
    name: string;
    isDirectory: boolean;
    isSymlink: boolean;
    size: number;
    modifiedAt: string;
    type: "directory" | "text" | "image" | "video" | "audio" | "binary";
    extension: string;
}

export interface FileContent {
    content: string;
    encoding: "utf-8" | "base64";
    size: number;
    readOnly: boolean;
    tooLarge: boolean;
}

export interface AgentInfo {
    url: string;
    username: string;
    name: string;
    endpoint: string;
}

export type AgentStatus = "online" | "offline" | "connecting";

// Docker stats from `docker stats --no-stream --format json`
export interface DockerStats {
    Name: string;
    CPUPerc: string;
    MemUsage: string;
    MemPerc: string;
    NetIO: string;
    BlockIO: string;
    PIDs: string;
}

// Socket.IO callback result
export interface CallbackResult {
    ok: boolean;
    msg?: string;
}
