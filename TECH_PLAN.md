# Dockge File Manager 技术方案

## 1. 背景与问题

### 1.1 现状痛点

Dockge 作为 Docker Compose 管理工具，用户经常需要为容器挂载配置文件和数据目录。当前的工作流程中，修改挂载文件非常不便：

- compose.yaml 中定义了 `volumes: ["./config:/app/config"]`，但**无法在 Dockge UI 中浏览或编辑这些文件**
- 用户必须 SSH 到服务器，手动用 `vim`/`nano` 编辑配置
- 或者通过容器终端进入容器内部修改，但容器重建后变更会丢失
- Compose.vue 中的 Volumes 编辑区域**已被禁用**（`v-if="false"`，第 212 行）
- 对于多主机（Agent）场景，远程主机上的文件更难访问

### 1.2 目标

将 File Browser 的核心文件管理能力集成到 Dockge 中，让用户在同一界面内完成：
- 浏览 Stack 目录下的文件结构
- 在线编辑配置文件（nginx.conf、.env、yaml 等）
- 上传/下载文件
- 创建/删除/重命名文件和目录
- 通过多主机 Agent 代理管理远程服务器上的文件

---

## 2. 设计原则

| 原则 | 说明 |
|------|------|
| **原生集成** | 不嵌入 File Browser 进程，而是在 Dockge 代码中用 TypeScript 实现文件管理功能 |
| **Socket.IO 优先** | 遵循 Dockge 已有架构，所有文件操作通过 Socket.IO 事件通信，不引入 REST API |
| **Agent 兼容** | 文件操作必须支持通过 AgentProxy 代理到远程主机 |
| **安全沙箱** | 文件访问严格限制在 Stack 目录内，防止路径遍历攻击 |
| **渐进增强** | 分阶段交付，MVP 聚焦核心浏览和编辑，后续迭代增加高级功能 |

---

## 3. 架构设计

### 3.1 整体架构

```
┌──────────────────────────────────────────────────────────┐
│                    Browser / Vue 3 SPA                    │
│                                                          │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ Compose.vue │  │ FileBrowser  │  │  FileEditor    │  │
│  │ (existing)  │  │   .vue       │  │   .vue         │  │
│  │             │  │ - 目录树      │  │ - CodeMirror   │  │
│  │ [文件管理]──┼──▶│ - 文件列表    │  │ - 图片预览     │  │
│  │  按钮       │  │ - 上传/下载   │  │ - 二进制下载    │  │
│  └─────────────┘  └──────┬───────┘  └───────┬────────┘  │
│                          │                   │           │
│                    Socket.IO Events          │           │
└──────────────────────────┼───────────────────┼───────────┘
                           │                   │
┌──────────────────────────▼───────────────────▼───────────┐
│                  AgentProxySocketHandler                  │
│            (路由到本地 or 远程 Agent)                       │
└──────────────────────────┬───────────────────────────────┘
                           │
            ┌──────────────▼──────────────┐
            │   FileSocketHandler (新增)   │
            │                             │
            │  - listDir                  │
            │  - readFile                 │
            │  - writeFile                │
            │  - createDir                │
            │  - deleteItem               │
            │  - renameItem               │
            │  - uploadFile (chunked)     │
            │  - downloadFile (stream)    │
            │  - getFileInfo              │
            │  - searchFiles              │
            │                             │
            │  PathValidator (安全沙箱)     │
            └──────────────┬──────────────┘
                           │
                    ┌──────▼──────┐
                    │  Node.js fs │
                    │  (文件系统)  │
                    └─────────────┘
```

### 3.2 访问范围设计

文件管理器需要明确访问范围，不能无限制访问宿主机文件系统：

```
可访问范围（三级权限）:

Level 1 - Stack 目录（默认）
  /opt/stacks/{stackName}/
  ├── compose.yaml        ← 已有编辑能力
  ├── .env                ← 已有编辑能力
  ├── config/             ← 新增：可浏览、编辑
  ├── data/               ← 新增：可浏览、编辑
  └── ...

Level 2 - 全局 Stacks 目录
  /opt/stacks/            ← 可浏览所有 Stack 的文件
  
Level 3 - 自定义可访问路径（配置白名单）
  用户可在 Settings 中配置额外可访问目录
  例如: /etc/nginx/, /var/log/
  ← 解决 compose.yaml 中绝对路径挂载的场景
```

---

## 4. 功能范围

### 4.1 MVP（Phase 1）

| 功能 | 说明 | 优先级 |
|------|------|--------|
| 目录浏览 | 列表/树形展示 Stack 目录下的文件和文件夹 | P0 |
| 文件查看 | 文本文件在线查看（语法高亮） | P0 |
| 文件编辑 | 文本文件在线编辑并保存 | P0 |
| 创建文件/目录 | 新建文件或文件夹 | P0 |
| 删除 | 删除文件或目录（带确认） | P0 |
| 重命名 | 重命名文件或目录 | P1 |
| 下载 | 单文件下载 | P1 |
| Agent 支持 | 通过 Agent 代理浏览远程主机文件 | P1 |

### 4.2 Enhanced（Phase 2）

| 功能 | 说明 | 优先级 |
|------|------|--------|
| 文件上传 | 拖拽或选择上传，支持分片传输 | P1 |
| 多文件下载 | 批量打包为 zip 下载 | P2 |
| 图片预览 | 缩略图预览和大图查看 | P2 |
| 文件搜索 | 按文件名搜索当前目录 | P2 |
| 复制/移动 | 文件/目录的复制和移动操作 | P2 |
| Volume 感知 | 解析 compose.yaml，高亮显示被挂载的目录 | P2 |

### 4.3 Advanced（Phase 3）

| 功能 | 说明 | 优先级 |
|------|------|--------|
| 自定义路径白名单 | Settings 页面配置可访问目录 | P2 |
| 文件权限展示 | 显示 chmod 权限信息 | P3 |
| 文件 diff | 编辑时对比修改前后差异 | P3 |
| 日志文件 tail | 实时 tail -f 查看日志文件 | P3 |

---

## 5. 后端设计

### 5.1 新增文件结构

```
backend/
├── agent-socket-handlers/
│   ├── docker-socket-handler.ts      (已有)
│   ├── terminal-socket-handler.ts    (已有)
│   └── file-socket-handler.ts        ← 新增：文件操作处理器
├── file-manager/
│   ├── file-manager.ts               ← 新增：文件操作核心逻辑
│   ├── path-validator.ts             ← 新增：路径安全验证
│   └── file-type-detector.ts         ← 新增：文件类型检测
└── ...
```

### 5.2 PathValidator — 安全沙箱

```typescript
// backend/file-manager/path-validator.ts

import path from "path";
import fs from "fs/promises";

export class PathValidator {
    private allowedRoots: string[];

    constructor(stacksDir: string, extraPaths: string[] = []) {
        this.allowedRoots = [
            path.resolve(stacksDir),
            ...extraPaths.map(p => path.resolve(p)),
        ];
    }

    /**
     * 验证路径是否在允许范围内，防止路径遍历攻击
     * - 解析 symlink 到真实路径
     * - 检查 resolved 路径是否以 allowedRoots 开头
     * - 拒绝包含 \0 (null byte) 的路径
     */
    async validate(requestedPath: string): Promise<string> {
        if (requestedPath.includes("\0")) {
            throw new Error("Invalid path: null byte detected");
        }

        const resolved = path.resolve(requestedPath);

        // 检查父目录是否存在（新建文件时，文件本身可能不存在）
        const checkPath = await this.existsOrParent(resolved);
        const realPath = await fs.realpath(checkPath);
        const fullReal = resolved.replace(checkPath, realPath);

        const isAllowed = this.allowedRoots.some(
            root => fullReal === root || fullReal.startsWith(root + path.sep)
        );

        if (!isAllowed) {
            throw new Error("Access denied: path outside allowed scope");
        }

        return resolved;
    }

    private async existsOrParent(p: string): Promise<string> {
        try {
            await fs.access(p);
            return p;
        } catch {
            return path.dirname(p);
        }
    }
}
```

### 5.3 FileManager — 核心文件操作

```typescript
// backend/file-manager/file-manager.ts

import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { PathValidator } from "./path-validator";

export interface FileEntry {
    name: string;
    isDirectory: boolean;
    isSymlink: boolean;
    size: number;
    modifiedAt: string;      // ISO 8601
    type: string;            // "text" | "image" | "video" | "audio" | "binary"
    extension: string;
}

export interface FileContent {
    content: string;         // UTF-8 文本内容（仅文本文件）
    encoding: "utf-8" | "base64";
    size: number;
    readOnly: boolean;
}

export class FileManager {
    private validator: PathValidator;

    // 可编辑文件大小上限: 2MB
    private static MAX_EDIT_SIZE = 2 * 1024 * 1024;
    // 目录列表条目上限
    private static MAX_LIST_ENTRIES = 1000;

    constructor(validator: PathValidator) {
        this.validator = validator;
    }

    /** 列出目录内容 */
    async listDir(dirPath: string): Promise<FileEntry[]> {
        const safePath = await this.validator.validate(dirPath);
        const entries = await fs.readdir(safePath, { withFileTypes: true });

        const result: FileEntry[] = [];
        let count = 0;

        for (const entry of entries) {
            if (count >= FileManager.MAX_LIST_ENTRIES) break;

            const fullPath = path.join(safePath, entry.name);
            try {
                const stat = await fs.stat(fullPath);
                result.push({
                    name: entry.name,
                    isDirectory: entry.isDirectory(),
                    isSymlink: entry.isSymlink(),
                    size: stat.size,
                    modifiedAt: stat.mtime.toISOString(),
                    type: this.detectType(entry.name, entry.isDirectory()),
                    extension: path.extname(entry.name).toLowerCase(),
                });
                count++;
            } catch {
                // 跳过无权限的文件
            }
        }

        // 排序: 目录在前，然后按名称字母排序
        result.sort((a, b) => {
            if (a.isDirectory !== b.isDirectory) {
                return a.isDirectory ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        });

        return result;
    }

    /** 读取文件内容 */
    async readFile(filePath: string): Promise<FileContent> {
        const safePath = await this.validator.validate(filePath);
        const stat = await fs.stat(safePath);

        if (stat.isDirectory()) {
            throw new Error("Cannot read directory as file");
        }

        if (stat.size > FileManager.MAX_EDIT_SIZE) {
            return {
                content: "",
                encoding: "utf-8",
                size: stat.size,
                readOnly: true,
            };
        }

        const buffer = await fs.readFile(safePath);
        const isText = this.isTextFile(filePath, buffer);

        return {
            content: isText
                ? buffer.toString("utf-8")
                : buffer.toString("base64"),
            encoding: isText ? "utf-8" : "base64",
            size: stat.size,
            readOnly: false,
        };
    }

    /** 写入文件 */
    async writeFile(filePath: string, content: string): Promise<void> {
        const safePath = await this.validator.validate(filePath);
        await fs.writeFile(safePath, content, "utf-8");
    }

    /** 创建目录 */
    async createDir(dirPath: string): Promise<void> {
        const safePath = await this.validator.validate(dirPath);
        await fs.mkdir(safePath, { recursive: true });
    }

    /** 创建空文件 */
    async createFile(filePath: string): Promise<void> {
        const safePath = await this.validator.validate(filePath);
        const dir = path.dirname(safePath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(safePath, "", "utf-8");
    }

    /** 删除文件或目录 */
    async deleteItem(itemPath: string): Promise<void> {
        const safePath = await this.validator.validate(itemPath);
        const stat = await fs.stat(safePath);
        if (stat.isDirectory()) {
            await fs.rm(safePath, { recursive: true, force: true });
        } else {
            await fs.unlink(safePath);
        }
    }

    /** 重命名 */
    async renameItem(oldPath: string, newName: string): Promise<void> {
        const safeOld = await this.validator.validate(oldPath);
        const newPath = path.join(path.dirname(safeOld), newName);
        const safeNew = await this.validator.validate(newPath);
        await fs.rename(safeOld, safeNew);
    }

    /** 获取文件信息 */
    async getFileInfo(filePath: string): Promise<FileEntry> {
        const safePath = await this.validator.validate(filePath);
        const stat = await fs.lstat(safePath);
        const name = path.basename(safePath);
        return {
            name,
            isDirectory: stat.isDirectory(),
            isSymlink: stat.isSymlinkCount(),
            size: stat.size,
            modifiedAt: stat.mtime.toISOString(),
            type: this.detectType(name, stat.isDirectory()),
            extension: path.extname(name).toLowerCase(),
        };
    }

    /** 搜索文件（按文件名） */
    async searchFiles(dirPath: string, query: string, maxResults = 50): Promise<FileEntry[]> {
        const safePath = await this.validator.validate(dirPath);
        const results: FileEntry[] = [];
        const lowerQuery = query.toLowerCase();

        await this.walkDir(safePath, safePath, lowerQuery, results, maxResults, 0);
        return results;
    }

    // --- 私有方法 ---

    private async walkDir(
        basePath: string, currentPath: string,
        query: string, results: FileEntry[],
        maxResults: number, depth: number,
    ): Promise<void> {
        if (depth > 10 || results.length >= maxResults) return;

        const entries = await fs.readdir(currentPath, { withFileTypes: true });
        for (const entry of entries) {
            if (results.length >= maxResults) break;
            if (entry.name.startsWith(".")) continue; // 跳过隐藏文件

            if (entry.name.toLowerCase().includes(query)) {
                const fullPath = path.join(currentPath, entry.name);
                const stat = await fs.stat(fullPath);
                results.push({
                    name: path.relative(basePath, fullPath),
                    isDirectory: entry.isDirectory(),
                    isSymlink: entry.isSymlink(),
                    size: stat.size,
                    modifiedAt: stat.mtime.toISOString(),
                    type: this.detectType(entry.name, entry.isDirectory()),
                    extension: path.extname(entry.name).toLowerCase(),
                });
            }

            if (entry.isDirectory()) {
                await this.walkDir(
                    basePath, path.join(currentPath, entry.name),
                    query, results, maxResults, depth + 1,
                );
            }
        }
    }

    private detectType(name: string, isDir: boolean): string {
        if (isDir) return "directory";
        const ext = path.extname(name).toLowerCase();
        const textExts = new Set([
            ".txt", ".md", ".json", ".yaml", ".yml", ".toml", ".xml",
            ".conf", ".cfg", ".ini", ".env", ".sh", ".bash", ".zsh",
            ".py", ".js", ".ts", ".go", ".rs", ".java", ".html", ".css",
            ".sql", ".log", ".csv", ".properties", ".dockerfile",
        ]);
        const imageExts = new Set([".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico", ".bmp"]);
        const videoExts = new Set([".mp4", ".webm", ".mkv", ".avi", ".mov"]);
        const audioExts = new Set([".mp3", ".wav", ".ogg", ".flac", ".aac"]);

        if (textExts.has(ext)) return "text";
        if (imageExts.has(ext)) return "image";
        if (videoExts.has(ext)) return "video";
        if (audioExts.has(ext)) return "audio";
        if (name === "Dockerfile" || name === "Makefile") return "text";
        return "binary";
    }

    private isTextFile(filePath: string, buffer: Buffer): boolean {
        if (this.detectType(path.basename(filePath), false) === "text") return true;
        // 检查前 8KB 是否包含 null byte（简单的二进制检测）
        const sample = buffer.subarray(0, 8192);
        return !sample.includes(0);
    }
}
```

### 5.4 FileSocketHandler — Socket.IO 事件处理

```typescript
// backend/agent-socket-handlers/file-socket-handler.ts

import path from "path";
import { AgentSocketHandler } from "../agent-socket-handler";
import { DockgeServer } from "../dockge-server";
import { callbackError, callbackResult, checkLogin, DockgeSocket, ValidationError } from "../util-server";
import { AgentSocket } from "../../common/agent-socket";
import { FileManager } from "../file-manager/file-manager";
import { PathValidator } from "../file-manager/path-validator";

export class FileSocketHandler extends AgentSocketHandler {
    create(socket: DockgeSocket, server: DockgeServer, agentSocket: AgentSocket) {

        const validator = new PathValidator(server.stacksDir);
        const fileManager = new FileManager(validator);

        // 列出目录
        agentSocket.on("file:listDir", async (dirPath: unknown, callback) => {
            try {
                checkLogin(socket);
                if (typeof dirPath !== "string") {
                    throw new ValidationError("Path must be a string");
                }
                const resolvedPath = path.resolve(server.stacksDir, dirPath);
                const entries = await fileManager.listDir(resolvedPath);
                callbackResult({ ok: true, entries }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // 读取文件
        agentSocket.on("file:read", async (filePath: unknown, callback) => {
            try {
                checkLogin(socket);
                if (typeof filePath !== "string") {
                    throw new ValidationError("Path must be a string");
                }
                const resolvedPath = path.resolve(server.stacksDir, filePath);
                const content = await fileManager.readFile(resolvedPath);
                callbackResult({ ok: true, ...content }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // 写入文件
        agentSocket.on("file:write", async (filePath: unknown, content: unknown, callback) => {
            try {
                checkLogin(socket);
                if (typeof filePath !== "string") {
                    throw new ValidationError("Path must be a string");
                }
                if (typeof content !== "string") {
                    throw new ValidationError("Content must be a string");
                }
                const resolvedPath = path.resolve(server.stacksDir, filePath);
                await fileManager.writeFile(resolvedPath, content);
                callbackResult({ ok: true, msg: "File saved" }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // 创建目录
        agentSocket.on("file:createDir", async (dirPath: unknown, callback) => {
            try {
                checkLogin(socket);
                if (typeof dirPath !== "string") {
                    throw new ValidationError("Path must be a string");
                }
                const resolvedPath = path.resolve(server.stacksDir, dirPath);
                await fileManager.createDir(resolvedPath);
                callbackResult({ ok: true, msg: "Directory created" }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // 创建文件
        agentSocket.on("file:createFile", async (filePath: unknown, callback) => {
            try {
                checkLogin(socket);
                if (typeof filePath !== "string") {
                    throw new ValidationError("Path must be a string");
                }
                const resolvedPath = path.resolve(server.stacksDir, filePath);
                await fileManager.createFile(resolvedPath);
                callbackResult({ ok: true, msg: "File created" }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // 删除
        agentSocket.on("file:delete", async (itemPath: unknown, callback) => {
            try {
                checkLogin(socket);
                if (typeof itemPath !== "string") {
                    throw new ValidationError("Path must be a string");
                }
                const resolvedPath = path.resolve(server.stacksDir, itemPath);
                await fileManager.deleteItem(resolvedPath);
                callbackResult({ ok: true, msg: "Deleted" }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // 重命名
        agentSocket.on("file:rename", async (itemPath: unknown, newName: unknown, callback) => {
            try {
                checkLogin(socket);
                if (typeof itemPath !== "string" || typeof newName !== "string") {
                    throw new ValidationError("Invalid parameters");
                }
                // 验证 newName 不包含路径分隔符
                if (newName.includes("/") || newName.includes("\\")) {
                    throw new ValidationError("New name cannot contain path separators");
                }
                const resolvedPath = path.resolve(server.stacksDir, itemPath);
                await fileManager.renameItem(resolvedPath, newName);
                callbackResult({ ok: true, msg: "Renamed" }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // 搜索
        agentSocket.on("file:search", async (dirPath: unknown, query: unknown, callback) => {
            try {
                checkLogin(socket);
                if (typeof dirPath !== "string" || typeof query !== "string") {
                    throw new ValidationError("Invalid parameters");
                }
                const resolvedPath = path.resolve(server.stacksDir, dirPath);
                const results = await fileManager.searchFiles(resolvedPath, query);
                callbackResult({ ok: true, results }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // 文件下载（通过 base64 传输小文件，大文件走 HTTP）
        agentSocket.on("file:download", async (filePath: unknown, callback) => {
            try {
                checkLogin(socket);
                if (typeof filePath !== "string") {
                    throw new ValidationError("Path must be a string");
                }
                const resolvedPath = path.resolve(server.stacksDir, filePath);
                const safePath = await validator.validate(resolvedPath);
                const stat = await (await import("fs/promises")).stat(safePath);

                // 限制 Socket.IO 传输大小: 10MB
                if (stat.size > 10 * 1024 * 1024) {
                    throw new ValidationError("File too large for download via WebSocket. Max: 10MB");
                }

                const buffer = await (await import("fs/promises")).readFile(safePath);
                callbackResult({
                    ok: true,
                    name: path.basename(safePath),
                    content: buffer.toString("base64"),
                    size: stat.size,
                }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });

        // 文件上传（base64 分片）
        agentSocket.on("file:upload", async (filePath: unknown, content: unknown, callback) => {
            try {
                checkLogin(socket);
                if (typeof filePath !== "string" || typeof content !== "string") {
                    throw new ValidationError("Invalid parameters");
                }
                const resolvedPath = path.resolve(server.stacksDir, filePath);
                const safePath = await validator.validate(resolvedPath);
                const buffer = Buffer.from(content, "base64");

                // 上传大小限制: 50MB
                if (buffer.length > 50 * 1024 * 1024) {
                    throw new ValidationError("File too large. Max: 50MB");
                }

                await (await import("fs/promises")).writeFile(safePath, buffer);
                callbackResult({ ok: true, msg: "Uploaded" }, callback);
            } catch (e) {
                callbackError(e, callback);
            }
        });
    }
}
```

### 5.5 注册到 DockgeServer

在 `backend/dockge-server.ts` 的 agent socket handler 列表中注册新的 handler：

```typescript
// 现有 handler 列表中添加
import { FileSocketHandler } from "./agent-socket-handlers/file-socket-handler";

// 在 agentSocketHandlers 数组中追加:
this.agentSocketHandlerList = [
    new DockerSocketHandler(),
    new TerminalSocketHandler(),
    new FileSocketHandler(),    // ← 新增
];
```

由于 `FileSocketHandler` 继承 `AgentSocketHandler`，它会自动被 `AgentProxySocketHandler` 代理，无需额外配置即可支持多主机。

---

## 6. 前端设计（React + shadcn/ui）

> **重要变更**：前端从 Dockge 原有的 Vue 3 + Bootstrap 重写为 React + shadcn/ui。
> 这意味着前端是一个**全新的 React 项目**，不复用 Dockge 的 Vue 代码，但复用其 Socket.IO 通信协议和后端。

### 6.1 技术选型

| 类别 | 选择 | 说明 |
|------|------|------|
| **框架** | React 19 + TypeScript | 函数组件 + Hooks |
| **构建** | Vite 6 | 与后端 dev server 配合（proxy） |
| **UI 组件** | shadcn/ui | 基于 Radix UI + Tailwind CSS，可定制性强 |
| **样式** | Tailwind CSS 4 | 原子化 CSS，shadcn/ui 的基础 |
| **路由** | React Router 7 | 客户端路由 |
| **状态管理** | Zustand | 轻量，适合 Socket.IO 场景 |
| **实时通信** | socket.io-client | 与后端 Socket.IO 对接 |
| **代码编辑器** | @uiw/react-codemirror | CodeMirror 6 的 React 封装 |
| **终端** | @xterm/xterm + @xterm/addon-fit | 容器终端 |
| **国际化** | react-i18next | i18n |
| **通知** | sonner | Toast 通知（shadcn/ui 推荐） |
| **图标** | lucide-react | shadcn/ui 默认图标库 |
| **表单** | react-hook-form + zod | 表单验证 |

### 6.2 前端项目结构

```
frontend/
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
├── components.json                    ← shadcn/ui 配置
└── src/
    ├── main.tsx                       ← 入口
    ├── app.tsx                        ← 根组件，路由配置
    │
    ├── components/
    │   ├── ui/                        ← shadcn/ui 组件（自动生成）
    │   │   ├── button.tsx
    │   │   ├── dialog.tsx
    │   │   ├── dropdown-menu.tsx
    │   │   ├── table.tsx
    │   │   ├── tabs.tsx
    │   │   ├── input.tsx
    │   │   ├── badge.tsx
    │   │   ├── breadcrumb.tsx
    │   │   ├── alert-dialog.tsx
    │   │   ├── context-menu.tsx
    │   │   ├── tooltip.tsx
    │   │   ├── skeleton.tsx
    │   │   └── ...
    │   │
    │   ├── layout/
    │   │   ├── sidebar.tsx            ← 侧边栏（Stack 列表）
    │   │   ├── header.tsx             ← 顶部栏
    │   │   └── layout.tsx             ← 整体布局
    │   │
    │   ├── stack/
    │   │   ├── stack-list.tsx         ← Stack 列表
    │   │   ├── stack-list-item.tsx    ← Stack 列表项
    │   │   ├── stack-actions.tsx      ← 操作按钮组（Deploy/Stop/...）
    │   │   ├── container-card.tsx     ← 容器状态卡片
    │   │   ├── yaml-editor.tsx        ← YAML 编辑器（CodeMirror）
    │   │   ├── env-editor.tsx         ← .env 编辑器
    │   │   └── terminal-output.tsx    ← Combined 终端输出
    │   │
    │   ├── file-manager/              ← 文件管理器（核心新增）
    │   │   ├── file-browser.tsx       ← 文件浏览器主组件
    │   │   ├── file-list.tsx          ← 文件列表（Table）
    │   │   ├── file-list-item.tsx     ← 文件行（右键菜单）
    │   │   ├── file-editor.tsx        ← 文件编辑器（CodeMirror）
    │   │   ├── file-breadcrumb.tsx    ← 面包屑导航
    │   │   ├── file-toolbar.tsx       ← 工具栏
    │   │   ├── file-preview.tsx       ← 文件预览（图片/文本）
    │   │   ├── file-upload-dialog.tsx ← 上传对话框
    │   │   ├── file-create-dialog.tsx ← 新建文件/目录对话框
    │   │   ├── file-rename-dialog.tsx ← 重命名对话框
    │   │   └── file-icon.tsx          ← 文件类型图标映射
    │   │
    │   ├── terminal/
    │   │   └── container-terminal.tsx ← 容器交互式终端
    │   │
    │   ├── settings/
    │   │   ├── general.tsx
    │   │   ├── appearance.tsx
    │   │   ├── security.tsx
    │   │   └── about.tsx
    │   │
    │   └── auth/
    │       ├── login-form.tsx
    │       ├── setup-form.tsx
    │       └── two-fa-dialog.tsx
    │
    ├── pages/
    │   ├── dashboard.tsx              ← 主面板（Stack 列表 + 右侧详情）
    │   ├── compose.tsx                ← Stack 详情页（YAML + Files Tab）
    │   ├── console.tsx                ← 服务器控制台
    │   ├── terminal.tsx               ← 容器终端页
    │   ├── settings.tsx               ← 设置页
    │   ├── login.tsx                  ← 登录页
    │   └── setup.tsx                  ← 初始化设置页
    │
    ├── hooks/
    │   ├── use-socket.ts              ← Socket.IO 连接管理
    │   ├── use-agent.ts               ← Agent 事件发送
    │   ├── use-file-manager.ts        ← 文件操作 Hook
    │   ├── use-stack.ts               ← Stack 操作 Hook
    │   └── use-auth.ts                ← 认证状态 Hook
    │
    ├── stores/
    │   ├── socket-store.ts            ← Socket 连接 + Stack 列表 + Agent 列表
    │   ├── auth-store.ts              ← 认证状态（token、user）
    │   └── theme-store.ts             ← 主题（light/dark）
    │
    ├── lib/
    │   ├── socket.ts                  ← Socket.IO client 单例
    │   ├── utils.ts                   ← cn() 工具函数（shadcn 标配）
    │   └── i18n.ts                    ← i18n 初始化
    │
    └── types/
        ├── stack.ts                   ← Stack/Container 类型定义
        ├── file.ts                    ← FileEntry/FileContent 类型
        └── agent.ts                   ← Agent 相关类型
```

### 6.3 页面布局设计

```
┌──────────────────────────────────────────────────────────────────┐
│  Header: [Logo] Dockge          [agent selector ▼]  [Settings]  │
├────────────┬─────────────────────────────────────────────────────┤
│            │                                                     │
│  Sidebar   │  Compose Page                                       │
│            │                                                     │
│  [Search]  │  my-stack (agent-1)                    [Status ●]  │
│            │  [Deploy] [Save] [Start] [Stop] [Restart] [...]    │
│  Stacks:   │                                                     │
│  ┌──────┐  │  ┌─────────────────┬───────────────────────────┐   │
│  │● web │  │  │                 │                           │   │
│  │● db  │  │  │  Containers     │  ┌─[YAML]─[.env]─[Files]─┐  │
│  │○ redis│  │  │                 │  │                        │  │
│  └──────┘  │  │  ┌───────────┐  │  │  breadcrumb: / > conf  │  │
│            │  │  │ web    ●  │  │  │  ┌──────────────────┐  │  │
│  Agents:   │  │  │ port:8080 │  │  │  │ ..               │  │  │
│  ┌──────┐  │  │  │ [shell]   │  │  │  │ 📁 conf.d/      │  │  │
│  │ local│  │  │  └───────────┘  │  │  │ 📄 nginx.conf   │  │  │
│  │ prod │  │  │  ┌───────────┐  │  │  │ 📄 mime.types   │  │  │
│  └──────┘  │  │  │ db     ●  │  │  │  └──────────────────┘  │  │
│            │  │  │ port:5432 │  │  │                        │  │
│            │  │  └───────────┘  │  │  [+ File] [+ Dir]      │  │
│            │  │                 │  │  [Upload] [Search]      │  │
│            │  │  Terminal       │  └────────────────────────┘  │
│            │  │  > Starting..  │                           │   │
│            │  │  > web started │                           │   │
│            │  └─────────────────┴───────────────────────────┘   │
│            │                                                     │
└────────────┴─────────────────────────────────────────────────────┘
```

### 6.4 Socket.IO 集成（Hooks + Zustand）

#### Socket Store — 全局状态

```typescript
// src/stores/socket-store.ts

import { create } from "zustand";
import { io, Socket } from "socket.io-client";
import type { Stack, Agent, AgentStatus } from "@/types";

interface SocketState {
    socket: Socket | null;
    connected: boolean;
    stackList: Record<string, Stack>;               // 本地 stacks
    agentStackList: Record<string, Record<string, Stack>>; // 按 endpoint 分组
    agentList: Record<string, Agent>;
    agentStatusList: Record<string, AgentStatus>;

    connect: (token: string) => void;
    disconnect: () => void;
    emitAgent: (endpoint: string, event: string, ...args: unknown[]) => void;
}

export const useSocketStore = create<SocketState>((set, get) => ({
    socket: null,
    connected: false,
    stackList: {},
    agentStackList: {},
    agentList: {},
    agentStatusList: {},

    connect: (token: string) => {
        const socket = io(window.location.origin, {
            transports: ["websocket"],
        });

        socket.on("connect", () => {
            set({ connected: true });
            socket.emit("loginByToken", token, (res: { ok: boolean }) => {
                if (!res.ok) {
                    useAuthStore.getState().logout();
                }
            });
        });

        socket.on("disconnect", () => set({ connected: false }));

        // Stack 列表实时更新
        socket.on("stackList", (data: Record<string, Stack>) => {
            set({ stackList: data });
        });

        // Agent Stack 列表
        socket.on("agentStackList", (endpoint: string, data: Record<string, Stack>) => {
            set((state) => ({
                agentStackList: { ...state.agentStackList, [endpoint]: data },
            }));
        });

        // Agent 状态
        socket.on("agentStatus", (endpoint: string, status: AgentStatus) => {
            set((state) => ({
                agentStatusList: { ...state.agentStatusList, [endpoint]: status },
            }));
        });

        set({ socket });
    },

    disconnect: () => {
        get().socket?.disconnect();
        set({ socket: null, connected: false });
    },

    emitAgent: (endpoint, event, ...args) => {
        const { socket } = get();
        if (!socket) return;
        socket.emit("agent", endpoint, event, ...args);
    },
}));
```

#### useFileManager Hook — 文件操作封装

```typescript
// src/hooks/use-file-manager.ts

import { useState, useCallback } from "react";
import { useSocketStore } from "@/stores/socket-store";
import type { FileEntry, FileContent } from "@/types/file";
import { toast } from "sonner";

export function useFileManager(stackName: string, endpoint: string) {
    const emitAgent = useSocketStore((s) => s.emitAgent);
    const [entries, setEntries] = useState<FileEntry[]>([]);
    const [loading, setLoading] = useState(false);

    const listDir = useCallback((relativePath: string) => {
        setLoading(true);
        const dirPath = relativePath
            ? `${stackName}/${relativePath}`
            : stackName;

        emitAgent(endpoint, "file:listDir", dirPath, (res: any) => {
            setLoading(false);
            if (res.ok) {
                setEntries(res.entries);
            } else {
                toast.error(res.msg ?? "Failed to list directory");
            }
        });
    }, [stackName, endpoint, emitAgent]);

    const readFile = useCallback((filePath: string): Promise<FileContent> => {
        return new Promise((resolve, reject) => {
            emitAgent(endpoint, "file:read", filePath, (res: any) => {
                if (res.ok) resolve(res);
                else reject(new Error(res.msg));
            });
        });
    }, [endpoint, emitAgent]);

    const writeFile = useCallback((filePath: string, content: string): Promise<void> => {
        return new Promise((resolve, reject) => {
            emitAgent(endpoint, "file:write", filePath, content, (res: any) => {
                if (res.ok) {
                    toast.success("File saved");
                    resolve();
                } else {
                    toast.error(res.msg ?? "Failed to save");
                    reject(new Error(res.msg));
                }
            });
        });
    }, [endpoint, emitAgent]);

    const createDir = useCallback((dirPath: string): Promise<void> => {
        return new Promise((resolve, reject) => {
            emitAgent(endpoint, "file:createDir", dirPath, (res: any) => {
                res.ok ? resolve() : reject(new Error(res.msg));
            });
        });
    }, [endpoint, emitAgent]);

    const createFile = useCallback((filePath: string): Promise<void> => {
        return new Promise((resolve, reject) => {
            emitAgent(endpoint, "file:createFile", filePath, (res: any) => {
                res.ok ? resolve() : reject(new Error(res.msg));
            });
        });
    }, [endpoint, emitAgent]);

    const deleteItem = useCallback((itemPath: string): Promise<void> => {
        return new Promise((resolve, reject) => {
            emitAgent(endpoint, "file:delete", itemPath, (res: any) => {
                if (res.ok) {
                    toast.success("Deleted");
                    resolve();
                } else {
                    toast.error(res.msg ?? "Failed to delete");
                    reject(new Error(res.msg));
                }
            });
        });
    }, [endpoint, emitAgent]);

    const renameItem = useCallback((itemPath: string, newName: string): Promise<void> => {
        return new Promise((resolve, reject) => {
            emitAgent(endpoint, "file:rename", itemPath, newName, (res: any) => {
                res.ok ? resolve() : reject(new Error(res.msg));
            });
        });
    }, [endpoint, emitAgent]);

    const downloadFile = useCallback((filePath: string) => {
        emitAgent(endpoint, "file:download", filePath, (res: any) => {
            if (!res.ok) {
                toast.error(res.msg ?? "Download failed");
                return;
            }
            // base64 → Blob → 触发浏览器下载
            const bytes = Uint8Array.from(atob(res.content), (c) => c.charCodeAt(0));
            const blob = new Blob([bytes]);
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = res.name;
            a.click();
            URL.revokeObjectURL(url);
        });
    }, [endpoint, emitAgent]);

    const searchFiles = useCallback((dirPath: string, query: string): Promise<FileEntry[]> => {
        return new Promise((resolve, reject) => {
            emitAgent(endpoint, "file:search", dirPath, query, (res: any) => {
                res.ok ? resolve(res.results) : reject(new Error(res.msg));
            });
        });
    }, [endpoint, emitAgent]);

    return {
        entries, loading,
        listDir, readFile, writeFile,
        createDir, createFile, deleteItem, renameItem,
        downloadFile, searchFiles,
    };
}
```

### 6.5 核心组件设计

#### FileBrowser — 文件浏览器主组件

```tsx
// src/components/file-manager/file-browser.tsx

import { useState, useEffect } from "react";
import { useFileManager } from "@/hooks/use-file-manager";
import { FileBreadcrumb } from "./file-breadcrumb";
import { FileToolbar } from "./file-toolbar";
import { FileList } from "./file-list";
import { FileEditor } from "./file-editor";
import { FileCreateDialog } from "./file-create-dialog";
import { FileUploadDialog } from "./file-upload-dialog";

interface FileBrowserProps {
    stackName: string;
    endpoint: string;
}

export function FileBrowser({ stackName, endpoint }: FileBrowserProps) {
    const [currentPath, setCurrentPath] = useState("");
    const [editingFile, setEditingFile] = useState<string | null>(null);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [createType, setCreateType] = useState<"file" | "dir">("file");
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

    const fm = useFileManager(stackName, endpoint);

    useEffect(() => {
        fm.listDir(currentPath);
    }, [currentPath]);

    const navigateTo = (path: string) => {
        setCurrentPath(path);
        setEditingFile(null);
    };

    const handleOpen = (entry: FileEntry) => {
        if (entry.isDirectory) {
            navigateTo(currentPath ? `${currentPath}/${entry.name}` : entry.name);
        } else if (entry.type === "text") {
            const fullPath = currentPath
                ? `${stackName}/${currentPath}/${entry.name}`
                : `${stackName}/${entry.name}`;
            setEditingFile(fullPath);
        } else {
            const fullPath = currentPath
                ? `${stackName}/${currentPath}/${entry.name}`
                : `${stackName}/${entry.name}`;
            fm.downloadFile(fullPath);
        }
    };

    // 编辑模式：显示编辑器
    if (editingFile) {
        return (
            <FileEditor
                filePath={editingFile}
                endpoint={endpoint}
                onClose={() => setEditingFile(null)}
                onSaved={() => fm.listDir(currentPath)}
            />
        );
    }

    // 浏览模式：显示文件列表
    return (
        <div className="flex flex-col gap-3">
            <FileBreadcrumb
                path={currentPath}
                onNavigate={navigateTo}
            />

            <FileToolbar
                onNewFile={() => { setCreateType("file"); setCreateDialogOpen(true); }}
                onNewDir={() => { setCreateType("dir"); setCreateDialogOpen(true); }}
                onUpload={() => setUploadDialogOpen(true)}
                onRefresh={() => fm.listDir(currentPath)}
            />

            <FileList
                entries={fm.entries}
                loading={fm.loading}
                currentPath={currentPath}
                stackName={stackName}
                onOpen={handleOpen}
                onDelete={async (entry) => {
                    const fullPath = currentPath
                        ? `${stackName}/${currentPath}/${entry.name}`
                        : `${stackName}/${entry.name}`;
                    await fm.deleteItem(fullPath);
                    fm.listDir(currentPath);
                }}
                onRename={async (entry, newName) => {
                    const fullPath = currentPath
                        ? `${stackName}/${currentPath}/${entry.name}`
                        : `${stackName}/${entry.name}`;
                    await fm.renameItem(fullPath, newName);
                    fm.listDir(currentPath);
                }}
                onDownload={(entry) => {
                    const fullPath = currentPath
                        ? `${stackName}/${currentPath}/${entry.name}`
                        : `${stackName}/${entry.name}`;
                    fm.downloadFile(fullPath);
                }}
            />

            <FileCreateDialog
                open={createDialogOpen}
                type={createType}
                onOpenChange={setCreateDialogOpen}
                onConfirm={async (name) => {
                    const fullPath = currentPath
                        ? `${stackName}/${currentPath}/${name}`
                        : `${stackName}/${name}`;
                    if (createType === "dir") {
                        await fm.createDir(fullPath);
                    } else {
                        await fm.createFile(fullPath);
                    }
                    fm.listDir(currentPath);
                }}
            />

            <FileUploadDialog
                open={uploadDialogOpen}
                onOpenChange={setUploadDialogOpen}
                stackName={stackName}
                currentPath={currentPath}
                endpoint={endpoint}
                onUploaded={() => fm.listDir(currentPath)}
            />
        </div>
    );
}
```

#### FileList — 文件列表（shadcn/ui Table + ContextMenu）

```tsx
// src/components/file-manager/file-list.tsx

import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    ContextMenu, ContextMenuContent, ContextMenuItem,
    ContextMenuSeparator, ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { FileIcon } from "./file-icon";
import { useState } from "react";
import type { FileEntry } from "@/types/file";

interface FileListProps {
    entries: FileEntry[];
    loading: boolean;
    currentPath: string;
    stackName: string;
    onOpen: (entry: FileEntry) => void;
    onDelete: (entry: FileEntry) => void;
    onRename: (entry: FileEntry, newName: string) => void;
    onDownload: (entry: FileEntry) => void;
}

function formatSize(bytes: number): string {
    if (bytes === 0) return "-";
    const units = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, {
        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
}

export function FileList({
    entries, loading, currentPath, onOpen, onDelete, onRename, onDownload,
}: FileListProps) {
    const [deleteTarget, setDeleteTarget] = useState<FileEntry | null>(null);

    if (loading) {
        return (
            <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                ))}
            </div>
        );
    }

    // 上级目录入口
    const parentEntry: FileEntry | null = currentPath
        ? { name: "..", isDirectory: true, isSymlink: false, size: 0,
            modifiedAt: "", type: "directory", extension: "" }
        : null;

    const allEntries = parentEntry ? [parentEntry, ...entries] : entries;

    return (
        <>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[50%]">Name</TableHead>
                        <TableHead className="w-[25%]">Size</TableHead>
                        <TableHead className="w-[25%]">Modified</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {allEntries.map((entry) => (
                        <ContextMenu key={entry.name}>
                            <ContextMenuTrigger asChild>
                                <TableRow
                                    className="cursor-pointer"
                                    onDoubleClick={() => onOpen(entry)}
                                >
                                    <TableCell className="flex items-center gap-2">
                                        <FileIcon entry={entry} />
                                        <span>{entry.name}</span>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {entry.isDirectory ? "-" : formatSize(entry.size)}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {entry.modifiedAt ? formatDate(entry.modifiedAt) : ""}
                                    </TableCell>
                                </TableRow>
                            </ContextMenuTrigger>
                            {entry.name !== ".." && (
                                <ContextMenuContent>
                                    <ContextMenuItem onClick={() => onOpen(entry)}>
                                        Open
                                    </ContextMenuItem>
                                    {!entry.isDirectory && (
                                        <ContextMenuItem onClick={() => onDownload(entry)}>
                                            Download
                                        </ContextMenuItem>
                                    )}
                                    <ContextMenuSeparator />
                                    <ContextMenuItem onClick={() => {
                                        const newName = prompt("New name:", entry.name);
                                        if (newName && newName !== entry.name) {
                                            onRename(entry, newName);
                                        }
                                    }}>
                                        Rename
                                    </ContextMenuItem>
                                    <ContextMenuItem
                                        className="text-destructive"
                                        onClick={() => setDeleteTarget(entry)}
                                    >
                                        Delete
                                    </ContextMenuItem>
                                </ContextMenuContent>
                            )}
                        </ContextMenu>
                    ))}
                </TableBody>
            </Table>

            {/* 删除确认 */}
            <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {deleteTarget?.isDirectory
                                ? "This will permanently delete the directory and all its contents."
                                : "This will permanently delete the file."}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground"
                            onClick={() => {
                                if (deleteTarget) onDelete(deleteTarget);
                                setDeleteTarget(null);
                            }}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
```

#### FileEditor — 文件编辑器（CodeMirror）

```tsx
// src/components/file-manager/file-editor.tsx

import { useState, useEffect, useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { yaml } from "@codemirror/lang-yaml";
import { json } from "@codemirror/lang-json";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { tokyoNight } from "@uiw/codemirror-theme-tokyo-night";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { useFileManager } from "@/hooks/use-file-manager";
import { useThemeStore } from "@/stores/theme-store";

const langExtensions: Record<string, () => any> = {
    ".yaml": yaml,    ".yml": yaml,
    ".json": json,
    ".js": () => javascript(),
    ".ts": () => javascript({ typescript: true }),
    ".jsx": () => javascript({ jsx: true }),
    ".tsx": () => javascript({ jsx: true, typescript: true }),
    ".py": python,
    ".html": html,    ".css": css,
};

interface FileEditorProps {
    filePath: string;
    endpoint: string;
    onClose: () => void;
    onSaved: () => void;
}

export function FileEditor({ filePath, endpoint, onClose, onSaved }: FileEditorProps) {
    const [content, setContent] = useState("");
    const [originalContent, setOriginalContent] = useState("");
    const [readOnly, setReadOnly] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const theme = useThemeStore((s) => s.theme);

    // 从 filePath 提取 stackName（第一段）
    const stackName = filePath.split("/")[0];
    const fm = useFileManager(stackName, endpoint);

    const fileName = filePath.split("/").pop() ?? "";
    const ext = "." + fileName.split(".").pop()?.toLowerCase();
    const modified = content !== originalContent;

    const extensions = useMemo(() => {
        const langFn = langExtensions[ext];
        return langFn ? [langFn()] : [];
    }, [ext]);

    useEffect(() => {
        setLoading(true);
        fm.readFile(filePath)
            .then((res) => {
                if (res.readOnly) {
                    setReadOnly(true);
                    setContent("// File too large to edit (> 2MB)");
                } else if (res.encoding === "base64") {
                    setReadOnly(true);
                    setContent("// Binary file - cannot edit");
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
        try {
            await fm.writeFile(filePath, content);
            setOriginalContent(content);
            onSaved();
        } finally {
            setSaving(false);
        }
    };

    // Ctrl+S / Cmd+S 快捷键
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "s") {
            e.preventDefault();
            if (modified && !saving && !readOnly) handleSave();
        }
    };

    if (loading) {
        return <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>;
    }

    if (loadError) {
        return (
            <div className="space-y-4">
                <p className="text-destructive">Failed to load: {loadError}</p>
                <Button variant="outline" onClick={onClose}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3" onKeyDown={handleKeyDown}>
            {/* 顶部状态栏 */}
            <div className="flex items-center gap-2">
                <span className="font-mono text-sm truncate flex-1">{fileName}</span>
                {modified && <Badge variant="outline">Modified</Badge>}
                {readOnly && <Badge variant="secondary">Read Only</Badge>}
            </div>

            {/* CodeMirror 编辑器 */}
            <div className="rounded-md border overflow-hidden">
                <CodeMirror
                    value={content}
                    onChange={setContent}
                    extensions={extensions}
                    theme={theme === "dark" ? tokyoNight : undefined}
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

            {/* 底部操作栏 */}
            <div className="flex justify-between">
                <Button variant="outline" onClick={onClose}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button
                    onClick={handleSave}
                    disabled={!modified || saving || readOnly}
                >
                    {saving
                        ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        : <Save className="mr-2 h-4 w-4" />}
                    Save
                </Button>
            </div>
        </div>
    );
}
```

### 6.6 与 Compose 页面集成

在 Compose 页面右侧使用 shadcn/ui `<Tabs>` 切换 YAML 编辑器和文件浏览器：

```tsx
// src/pages/compose.tsx (关键片段)

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { YamlEditor } from "@/components/stack/yaml-editor";
import { EnvEditor } from "@/components/stack/env-editor";
import { FileBrowser } from "@/components/file-manager/file-browser";
import { Code, FolderOpen, FileCode } from "lucide-react";

export function ComposePage() {
    const { stackName, endpoint } = useParams();
    // ...stack loading logic...

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 左侧：容器列表 + 终端 */}
            <div className="space-y-4">
                <StackActions stack={stack} />
                <ContainerList services={stack.services} />
                <TerminalOutput stackName={stackName} endpoint={endpoint} />
            </div>

            {/* 右侧：YAML / .env / Files Tab 切换 */}
            <Tabs defaultValue="yaml">
                <TabsList>
                    <TabsTrigger value="yaml">
                        <Code className="mr-2 h-4 w-4" /> YAML
                    </TabsTrigger>
                    <TabsTrigger value="env">
                        <FileCode className="mr-2 h-4 w-4" /> .env
                    </TabsTrigger>
                    <TabsTrigger value="files">
                        <FolderOpen className="mr-2 h-4 w-4" /> Files
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="yaml">
                    <YamlEditor
                        value={composeYAML}
                        onChange={setComposeYAML}
                        readOnly={!editMode}
                    />
                </TabsContent>

                <TabsContent value="env">
                    <EnvEditor
                        value={composeENV}
                        onChange={setComposeENV}
                        readOnly={!editMode}
                    />
                </TabsContent>

                <TabsContent value="files">
                    <FileBrowser
                        stackName={stackName!}
                        endpoint={endpoint ?? ""}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}
```

### 6.7 路由配置

```tsx
// src/app.tsx

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "@/components/layout/layout";
import { Dashboard } from "@/pages/dashboard";
import { ComposePage } from "@/pages/compose";
import { ConsolePage } from "@/pages/console";
import { TerminalPage } from "@/pages/terminal";
import { SettingsPage } from "@/pages/settings";
import { LoginPage } from "@/pages/login";
import { SetupPage } from "@/pages/setup";

export function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/setup" element={<SetupPage />} />
                <Route path="/login" element={<LoginPage />} />

                <Route element={<Layout />}>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/compose" element={<ComposePage />} />
                    <Route path="/compose/:stackName" element={<ComposePage />} />
                    <Route path="/compose/:stackName/:endpoint" element={<ComposePage />} />
                    <Route path="/terminal/:stackName/:serviceName/:type" element={<TerminalPage />} />
                    <Route path="/terminal/:stackName/:serviceName/:type/:endpoint" element={<TerminalPage />} />
                    <Route path="/console" element={<ConsolePage />} />
                    <Route path="/console/:endpoint" element={<ConsolePage />} />
                    <Route path="/settings/*" element={<SettingsPage />} />
                </Route>

                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
        </BrowserRouter>
    );
}
```

### 6.8 主题设计（Tailwind CSS + shadcn/ui）

shadcn/ui 使用 CSS 变量实现主题切换，天然支持 dark mode：

```css
/* src/index.css */

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
    :root {
        --background: 0 0% 100%;
        --foreground: 222.2 84% 4.9%;
        --primary: 142.1 76.2% 36.3%;       /* Dockge 绿色调 */
        --primary-foreground: 355.7 100% 97.3%;
        --destructive: 0 84.2% 60.2%;
        --muted: 210 40% 96.1%;
        --muted-foreground: 215.4 16.3% 46.9%;
        --border: 214.3 31.8% 91.4%;
        --radius: 0.5rem;
        /* ...shadcn/ui 其他变量... */
    }

    .dark {
        --background: 222.2 84% 4.9%;       /* 深色背景 */
        --foreground: 210 40% 98%;
        --primary: 142.1 70.6% 45.3%;
        --muted: 217.2 32.6% 17.5%;
        --muted-foreground: 215 20.2% 65.1%;
        --border: 217.2 32.6% 17.5%;
    }
}
```

---

## 7. 安全设计

### 7.1 路径遍历防护

这是文件管理功能最核心的安全考虑：

```
攻击向量                     防护措施
─────────────────────────────────────────────────────
../../../etc/passwd          path.resolve() + 前缀检查
symlink → /etc/shadow       fs.realpath() 解析真实路径后检查
/opt/stacks/../../root       resolve 后不以 stacksDir 开头，拒绝
null byte: foo\0.txt         显式检查 \0 字符
URL 编码: %2e%2e%2f          Socket.IO 不涉及 URL 解码，天然防护
超长路径名                   操作系统层面限制
```

### 7.2 文件大小限制

| 操作 | 限制 | 理由 |
|------|------|------|
| 文本编辑 | 2 MB | 超大文件前端 CodeMirror 性能下降 |
| Socket.IO 下载 | 10 MB | WebSocket 帧大小限制 |
| 上传 | 50 MB | 配置文件场景足够，避免内存暴涨 |
| 目录列表 | 1000 条目 | 防止巨大目录导致响应过慢 |
| 搜索深度 | 10 层 | 防止深度遍历消耗资源 |

### 7.3 权限控制

- 所有文件操作必须通过 `checkLogin(socket)` 验证登录状态
- 文件管理权限与 Dockge 用户权限绑定（未来可扩展为 RBAC）
- compose.yaml 和 .env 文件的编辑走原有流程，不受文件管理器影响
- 删除操作需要前端二次确认

### 7.4 敏感文件保护

在 `PathValidator` 中增加敏感文件过滤：

```typescript
private static PROTECTED_PATTERNS = [
    /\.git\//,           // Git 目录
    /\.ssh\//,           // SSH 密钥
    /id_rsa/,
    /\.pem$/,
    /password/i,         // 仅在白名单目录外生效
];
```

---

## 8. 多主机 Agent 支持

### 8.1 工作原理

文件操作天然兼容 Dockge 的 Agent 代理架构，因为 `FileSocketHandler` 继承 `AgentSocketHandler`：

```
用户在 UI 操作远程主机文件:

Frontend                    Primary Server              Remote Agent
   │                            │                          │
   │  emit("agent",             │                          │
   │    "remote:5001",          │                          │
   │    "file:listDir",         │                          │
   │    "my-stack/config")      │                          │
   │ ──────────────────────────▶│                          │
   │                            │  proxy via Socket.IO     │
   │                            │ ─────────────────────────▶│
   │                            │                          │ fs.readdir()
   │                            │                          │
   │                            │  ◀─────────────────────── │
   │  ◀─────────────────────────│     callback(entries)    │
   │     callback(entries)      │                          │
```

### 8.2 前端 Agent 感知

文件浏览器通过 Zustand store 的 `emitAgent()` 方法发送事件，自动路由到正确的 Agent：

```typescript
// 在 useFileManager hook 中
const emitAgent = useSocketStore((s) => s.emitAgent);

emitAgent(
    endpoint,             // "" = 本地, "host:port" = 远程 Agent
    "file:listDir",
    fullDirPath,
    callback
);
```

---

## 9. 实施计划

### Phase 0 — React 前端脚手架（1-2 周）

由于前端从 Vue 切换到 React，需要先搭建基础框架并移植 Dockge 已有功能。

```
Week 1:
  ├── Vite + React + TypeScript 项目初始化
  ├── Tailwind CSS + shadcn/ui 初始化（npx shadcn@latest init）
  ├── 安装基础 shadcn/ui 组件（button, table, tabs, dialog, dropdown-menu, ...）
  ├── Zustand store 骨架（auth-store, socket-store, theme-store）
  ├── Socket.IO client 集成（useSocket hook）
  ├── React Router 路由配置
  ├── Layout 组件（sidebar + header）
  └── 登录页 + 认证流程

Week 2:
  ├── Dashboard 页面（Stack 列表）
  ├── Compose 页面骨架（YAML 编辑器 + 容器列表）
  ├── CodeMirror YAML 编辑器集成（@uiw/react-codemirror）
  ├── Terminal 组件（@xterm/xterm）
  ├── Agent 多主机选择器
  ├── react-i18next 国际化基础
  ├── sonner Toast 通知
  └── dark/light 主题切换
```

### Phase 1 — 文件管理器核心（2-3 周）

```
Week 3:
  ├── 后端: PathValidator 实现 + 单元测试
  ├── 后端: FileManager 核心方法（listDir, readFile, writeFile）
  ├── 后端: FileSocketHandler 注册 + 基础事件
  ├── 前端: useFileManager hook
  └── 前端: FileBrowser + FileList 组件

Week 4:
  ├── 前端: FileEditor（CodeMirror，语法高亮按扩展名切换）
  ├── 前端: FileBreadcrumb 面包屑导航
  ├── 后端: createDir / createFile / delete / rename 事件
  ├── 前端: FileCreateDialog, FileRenameDialog (shadcn Dialog)
  ├── 前端: 右键菜单 (shadcn ContextMenu)
  └── 前端: Compose 页面 Tabs 集成（YAML / .env / Files）

Week 5:
  ├── Agent 代理文件操作端到端测试
  ├── 错误处理 + Toast 通知
  ├── Ctrl+S 快捷键保存
  └── 安全测试（路径遍历、大文件、symlink 逃逸）
```

### Phase 2 — 上传下载与增强（1-2 周）

```
Week 6:
  ├── 后端: file:download / file:upload 事件
  ├── 前端: FileUploadDialog（拖拽上传 + 进度条）
  ├── 前端: 文件下载（base64 → Blob → saveAs）
  └── 前端: 图片预览组件

Week 7:
  ├── 前端: 文件搜索（搜索框 + 结果列表）
  ├── 前端: Volume 感知（解析 compose.yaml，高亮挂载目录）
  └── 性能优化（虚拟滚动、大目录分页）
```

### Phase 3 — 高级功能（1-2 周）

```
Week 8-9:
  ├── Settings 页面：可访问路径白名单配置
  ├── 复制/移动操作
  ├── 文件权限显示
  └── 日志文件 tail 实时查看（WebSocket 流式推送）
```

---

## 10. 技术决策记录

| 决策 | 选择 | 备选 | 理由 |
|------|------|------|------|
| 集成方式 | 原生 TypeScript 实现 | 嵌入 File Browser 进程 | 统一技术栈，共享认证，Agent 兼容 |
| 通信协议 | Socket.IO 事件 | 新增 REST API | 遵循 Dockge 后端架构，复用 Agent 代理 |
| **前端框架** | **React 19 + TypeScript** | Vue 3（原 Dockge） | 用户指定，生态更大，shadcn/ui 支持好 |
| **UI 组件库** | **shadcn/ui (Radix + Tailwind)** | Bootstrap / Ant Design | 可定制性强、bundle 小、设计感好 |
| **状态管理** | **Zustand** | Redux / Jotai / Context | 轻量无 boilerplate，适合 Socket.IO 状态同步 |
| 代码编辑器 | @uiw/react-codemirror | Monaco / Ace | CodeMirror 6 轻量，与 shadcn 风格统一 |
| 文件传输 | base64 over Socket.IO | HTTP multipart | 简单，复用现有连接，50MB 以内足够 |
| 数据库 | 无（纯文件系统操作） | 存储文件元数据到 SQLite | 配置文件场景不需要索引，KISS |
| 访问范围 | Stack 目录 + 可配置白名单 | 全盘访问 | 安全第一，最小权限原则 |
| 前端位置 | Compose 页面内嵌 Tab | 独立页面 | 操作上下文紧密，减少页面跳转 |

---

## 11. 依赖变更

### 后端新增依赖

无。后端完全基于 Node.js 内置的 `fs`/`path` 模块和 Dockge 已有的依赖（Socket.IO）。

### 前端依赖（新 React 项目）

**核心依赖：**

| 包名 | 用途 |
|------|------|
| `react`, `react-dom` | React 框架 |
| `vite`, `@vitejs/plugin-react` | 构建工具 |
| `typescript` | 类型系统 |
| `tailwindcss`, `@tailwindcss/vite` | 原子化 CSS |
| `class-variance-authority`, `clsx`, `tailwind-merge` | shadcn/ui 工具函数 |
| `@radix-ui/*` | shadcn/ui 底层原语（按需安装） |
| `lucide-react` | 图标 |
| `react-router-dom` | 路由 |
| `zustand` | 状态管理 |
| `socket.io-client` | Socket.IO 客户端 |
| `@uiw/react-codemirror` | CodeMirror 编辑器 |
| `@codemirror/lang-yaml`, `lang-json`, `lang-javascript`, `lang-python`, `lang-html`, `lang-css` | 语法高亮 |
| `@uiw/codemirror-theme-tokyo-night` | 编辑器暗色主题 |
| `@xterm/xterm`, `@xterm/addon-fit` | 终端模拟器 |
| `react-i18next`, `i18next` | 国际化 |
| `sonner` | Toast 通知 |
| `react-hook-form`, `zod`, `@hookform/resolvers` | 表单验证 |

### 可选依赖（Phase 2+）

| 包名 | 用途 | 阶段 |
|------|------|------|
| `archiver`（后端） | 多文件打包下载为 zip | Phase 2 |
| `@tanstack/react-virtual` | 大目录虚拟滚动 | Phase 2 |
| `sharp`（后端） | 图片缩略图生成 | Phase 3 |
| `chokidar`（后端） | 文件变更监听（实时刷新） | Phase 3 |

---

## 12. 风险评估

| 风险 | 级别 | 缓解措施 |
|------|------|---------|
| 路径遍历漏洞 | **高** | PathValidator + realpath + 前缀检查 + 安全审计 |
| 符号链接逃逸 | **高** | realpath 解析 + 检查真实路径 |
| React 前端重写工作量 | **中** | Phase 0 专注脚手架，复用后端 Socket.IO 协议不变；Dockge 前端功能逐步移植，不要求 1:1 完整还原 |
| 大文件导致内存溢出 | 中 | 严格大小限制 + 流式读取（Phase 2） |
| Socket.IO 传输瓶颈 | 中 | 50MB 上限，超大文件建议 SSH |
| shadcn/ui 组件覆盖度 | 低 | shadcn 组件丰富，缺失组件可基于 Radix UI 自行封装 |
| 并发编辑冲突 | 低 | 自托管场景通常单用户，MVP 不处理 |
| Agent 网络延迟 | 低 | 文件列表分页 + loading 状态 |
