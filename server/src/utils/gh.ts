import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

/**
 * Execute a `gh` CLI command and return stdout.
 * On failure, surfaces GitHub's error message from stderr rather than
 * Node's generic execFile error message.
 */
export async function ghExec(
  args: string[],
  options?: { input?: string; timeout?: number }
): Promise<string> {
  try {
    const { stdout } = await exec("gh", args, {
      timeout: options?.timeout ?? 30000,
      input: options?.input,
    });
    return stdout;
  } catch (e: unknown) {
    const stderr =
      e instanceof Error && "stderr" in e
        ? String((e as { stderr: unknown }).stderr).trim()
        : "";
    const message = e instanceof Error ? e.message : String(e);
    throw new Error(stderr || message);
  }
}
