import fs from "fs/promises";
import path from "path";
import { PathValidator } from "./path-validator";

export interface FileEntry {
    name: string;
    isDirectory: boolean;
    isSymlink: boolean;
    size: number;
    modifiedAt: string;
    type: string;
    extension: string;
}

export interface FileContent {
    content: string;
    encoding: "utf-8" | "base64";
    size: number;
    readOnly: boolean;
    tooLarge: boolean;
}

export class FileManager {
    private validator: PathValidator;

    private static MAX_EDIT_SIZE = 2 * 1024 * 1024;
    private static MAX_LIST_ENTRIES = 1000;

    constructor(validator: PathValidator) {
        this.validator = validator;
    }

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
                    isSymlink: entry.isSymbolicLink(),
                    size: stat.size,
                    modifiedAt: stat.mtime.toISOString(),
                    type: this.detectType(entry.name, entry.isDirectory()),
                    extension: path.extname(entry.name).toLowerCase(),
                });
                count++;
            } catch {
                // skip files we can't stat
            }
        }

        result.sort((a, b) => {
            if (a.isDirectory !== b.isDirectory) {
                return a.isDirectory ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        });

        return result;
    }

    async readFile(filePath: string): Promise<FileContent> {
        const safePath = await this.validator.validate(filePath);
        const stat = await fs.stat(safePath);

        if (stat.isDirectory()) {
            throw new Error("Cannot read directory as file");
        }

        if (stat.size > FileManager.MAX_EDIT_SIZE) {
            // Distinguish "truly empty" from "too large to edit" so the UI can
            // show a proper message instead of an empty editor
            return {
                content: "",
                encoding: "utf-8",
                size: stat.size,
                readOnly: true,
                tooLarge: true,
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
            tooLarge: false,
        };
    }

    async writeFile(filePath: string, content: string): Promise<void> {
        const safePath = await this.validator.validate(filePath);
        await fs.writeFile(safePath, content, "utf-8");
    }

    async createDir(dirPath: string): Promise<void> {
        const safePath = await this.validator.validate(dirPath);
        await fs.mkdir(safePath, { recursive: true });
    }

    async createFile(filePath: string): Promise<void> {
        const safePath = await this.validator.validate(filePath);
        const dir = path.dirname(safePath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(safePath, "", "utf-8");
    }

    async deleteItem(itemPath: string): Promise<void> {
        const safePath = await this.validator.validate(itemPath);
        const stat = await fs.stat(safePath);
        if (stat.isDirectory()) {
            await fs.rm(safePath, { recursive: true, force: true });
        } else {
            await fs.unlink(safePath);
        }
    }

    async renameItem(oldPath: string, newName: string): Promise<void> {
        const safeOld = await this.validator.validate(oldPath);
        const newPath = path.join(path.dirname(safeOld), newName);
        await this.validator.validate(newPath);
        await fs.rename(safeOld, newPath);
    }

    async searchFiles(
        dirPath: string,
        query: string,
        maxResults = 50
    ): Promise<FileEntry[]> {
        const safePath = await this.validator.validate(dirPath);
        const results: FileEntry[] = [];
        const lowerQuery = query.toLowerCase();

        await this.walkDir(safePath, safePath, lowerQuery, results, maxResults, 0);
        return results;
    }

    private async walkDir(
        basePath: string,
        currentPath: string,
        query: string,
        results: FileEntry[],
        maxResults: number,
        depth: number
    ): Promise<void> {
        if (depth > 10 || results.length >= maxResults) return;

        const entries = await fs.readdir(currentPath, { withFileTypes: true });
        for (const entry of entries) {
            if (results.length >= maxResults) break;
            if (entry.name.startsWith(".")) continue;

            if (entry.name.toLowerCase().includes(query)) {
                const fullPath = path.join(currentPath, entry.name);
                const stat = await fs.stat(fullPath);
                results.push({
                    name: path.relative(basePath, fullPath),
                    isDirectory: entry.isDirectory(),
                    isSymlink: entry.isSymbolicLink(),
                    size: stat.size,
                    modifiedAt: stat.mtime.toISOString(),
                    type: this.detectType(entry.name, entry.isDirectory()),
                    extension: path.extname(entry.name).toLowerCase(),
                });
            }

            if (entry.isDirectory()) {
                await this.walkDir(
                    basePath,
                    path.join(currentPath, entry.name),
                    query,
                    results,
                    maxResults,
                    depth + 1
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
        const imageExts = new Set([
            ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico", ".bmp",
        ]);

        if (textExts.has(ext)) return "text";
        if (imageExts.has(ext)) return "image";
        if (name === "Dockerfile" || name === "Makefile") return "text";
        return "binary";
    }

    private isTextFile(filePath: string, buffer: Buffer): boolean {
        if (this.detectType(path.basename(filePath), false) === "text")
            return true;
        const sample = buffer.subarray(0, 8192);
        return !sample.includes(0);
    }
}
