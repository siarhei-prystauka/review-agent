import { spawn } from "node:child_process";

/**
 * Execute a `gh` CLI command and return stdout.
 * On failure, surfaces GitHub's error message from stderr rather than
 * Node's generic error message.
 */
export async function ghExec(
  args: string[],
  options?: { input?: string; timeout?: number }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeoutMs = options?.timeout ?? 30000;
    const child = spawn("gh", args, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout!.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr!.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`gh command timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.on("close", (code: number | null) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(stderr.trim() || `gh exited with code ${code}`));
      }
    });

    child.on("error", (err: Error) => {
      clearTimeout(timer);
      reject(err);
    });

    if (options?.input !== undefined) {
      child.stdin!.write(options.input);
    }
    child.stdin!.end();
  });
}

/**
 * Fetch a paginated GitHub API list endpoint as a single flat array.
 * Uses `gh api --paginate --slurp` (yields `[page1, page2, ...]` where each
 * page is itself an array) and flattens. Avoids string-level concatenation
 * of raw pages, which can corrupt any JSON value containing `]...[`.
 */
export async function ghApiPaginatedList<T = unknown>(endpoint: string): Promise<T[]> {
  const raw = await ghExec(["api", endpoint, "--paginate", "--slurp"]);
  const pages = JSON.parse(raw) as T[][];
  return pages.flat();
}
