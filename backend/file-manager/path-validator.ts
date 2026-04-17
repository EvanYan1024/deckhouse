import path from "path";
import fs from "fs/promises";

export class PathValidator {
    private allowedRoots: string[];

    constructor(stacksDir: string, extraPaths: string[] = []) {
        this.allowedRoots = [
            path.resolve(stacksDir),
            ...extraPaths.map((p) => path.resolve(p)),
        ];
    }

    /**
     * Validate that a requested path is within the allowed scope.
     * Returns the canonicalized safe path on success, throws on violation.
     */
    async validate(requestedPath: string): Promise<string> {
        if (requestedPath.includes("\0")) {
            throw new Error("Invalid path: null byte detected");
        }

        const resolved = path.resolve(requestedPath);

        // Resolve symlinks on the existing portion of the path
        const checkPath = await this.existsOrParent(resolved);
        const realCheckPath = await fs.realpath(checkPath);

        // Reconstruct via relative offset — never use String.replace()
        const relativeRemainder = path.relative(checkPath, resolved);
        const fullReal = relativeRemainder
            ? path.join(realCheckPath, relativeRemainder)
            : realCheckPath;

        const isAllowed = this.allowedRoots.some(
            (root) => fullReal === root || fullReal.startsWith(root + path.sep)
        );

        if (!isAllowed) {
            throw new Error("Access denied: path outside allowed scope");
        }

        // Return the validated canonical path, not the original input
        return fullReal;
    }

    private async existsOrParent(p: string): Promise<string> {
        try {
            await fs.access(p);
            return p;
        } catch {
            const parent = path.dirname(p);
            if (parent === p) return p; // filesystem root
            return this.existsOrParent(parent);
        }
    }
}
