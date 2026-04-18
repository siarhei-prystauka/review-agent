import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ghExec, ghApiPaginatedList } from "../utils/gh.js";
import { PrIdentifierSchema } from "../utils/schemas.js";

// Single-object endpoints — no pagination needed.
async function ghApi(endpoint: string): Promise<string> {
  return ghExec(["api", endpoint]);
}

// --paginate is intentionally omitted: the diff Accept header returns raw text,
// not a JSON array, so gh's pagination logic does not apply here.
async function ghApiRaw(endpoint: string, accept: string): Promise<string> {
  return ghExec(["api", endpoint, "-H", `Accept: ${accept}`]);
}

export function registerPrTools(server: McpServer): void {
  server.registerTool(
    "get_pr_info",
    {
      description:
        "Fetch structured metadata for a pull request including title, description, author, state, labels, and reviewers.",
      inputSchema: PrIdentifierSchema.shape,
    },
    async ({ owner, repo, pr_number }) => {
      const raw = await ghApi(`repos/${owner}/${repo}/pulls/${pr_number}`);
      const pr = JSON.parse(raw);
      const result = {
        number: pr.number,
        title: pr.title,
        body: pr.body,
        state: pr.state,
        draft: pr.draft,
        author: pr.user?.login,
        created_at: pr.created_at,
        updated_at: pr.updated_at,
        head_branch: pr.head?.ref,
        base_branch: pr.base?.ref,
        labels: pr.labels?.map((l: { name: string }) => l.name) ?? [],
        reviewers:
          pr.requested_reviewers?.map((r: { login: string }) => r.login) ?? [],
        additions: pr.additions,
        deletions: pr.deletions,
        changed_files: pr.changed_files,
        mergeable: pr.mergeable,
        url: pr.html_url,
      };
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "get_pr_diff",
    {
      description:
        "Fetch the PR diff parsed into per-file change objects with hunks, added/removed lines, and line numbers. Returns structured, machine-readable diff data.",
      inputSchema: PrIdentifierSchema.shape,
    },
    async ({ owner, repo, pr_number }) => {
      const raw = await ghApiRaw(
        `repos/${owner}/${repo}/pulls/${pr_number}`,
        "application/vnd.github.v3.diff"
      );
      const result = parseDiff(raw);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "get_pr_files",
    {
      description:
        "List all changed files in a PR with their change types (added, modified, deleted, renamed) and patch statistics.",
      inputSchema: PrIdentifierSchema.shape,
    },
    async ({ owner, repo, pr_number }) => {
      const files = await ghApiPaginatedList<{
        filename: string;
        status: string;
        additions: number;
        deletions: number;
        changes: number;
        previous_filename?: string;
      }>(`repos/${owner}/${repo}/pulls/${pr_number}/files`);
      const result = files.map(
        (f) => ({
          filename: f.filename,
          status: f.status,
          additions: f.additions,
          deletions: f.deletions,
          changes: f.changes,
          previous_filename: f.previous_filename ?? null,
        })
      );
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "get_pr_commits",
    {
      description:
        "Fetch the list of commits in a pull request, including commit messages, authors, and timestamps. Useful for understanding the change history and commit quality.",
      inputSchema: PrIdentifierSchema.shape,
    },
    async ({ owner, repo, pr_number }) => {
      const commits = await ghApiPaginatedList<{
        sha: string;
        commit: {
          message: string;
          author: { name: string; date: string };
        };
        author?: { login: string };
      }>(`repos/${owner}/${repo}/pulls/${pr_number}/commits`);
      const result = commits.map(
        (c) => ({
          sha: c.sha.substring(0, 8),
          message: c.commit.message,
          author: c.author?.login ?? c.commit.author?.name,
          date: c.commit.author?.date,
        })
      );
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "get_file_content",
    {
      description:
        "Fetch the content of a file from a GitHub repository at a specific ref (branch, tag, or commit SHA). Use this to read CLAUDE.md, configuration files, or any source file from the PR's repository.",
      inputSchema: {
        owner: z.string().describe("Repository owner"),
        repo: z.string().describe("Repository name"),
        path: z
          .string()
          .refine(
            (p) => !p.startsWith("/") && !p.includes(".."),
            "Path must be relative and must not contain '..'"
          )
          .describe("File path relative to repo root (e.g., 'CLAUDE.md')"),
        ref: z
          .string()
          .optional()
          .describe(
            "Branch, tag, or commit SHA to read from. Defaults to the default branch."
          ),
      },
    },
    async ({ owner, repo, path, ref }) => {
      // Encode each segment so characters like `?`, `#`, `&`, or spaces in
      // the path cannot inject query parameters or otherwise malform the URL.
      const encodedPath = path.split("/").map(encodeURIComponent).join("/");
      const endpoint =
        `repos/${owner}/${repo}/contents/${encodedPath}` +
        (ref ? `?ref=${encodeURIComponent(ref)}` : "");

      const raw = await ghExec(["api", endpoint]);
      const data = JSON.parse(raw);

      if (data.type !== "file") {
        throw new Error(`Path "${path}" is not a file (type: ${data.type})`);
      }

      const content = Buffer.from(data.content, "base64").toString("utf-8");
      const result = { path, ref: data.sha, size: data.size, content };
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}

interface DiffHunk {
  old_start: number;
  old_count: number;
  new_start: number;
  new_count: number;
  lines: {
    type: "add" | "remove" | "context";
    content: string;
    new_line?: number;
    old_line?: number;
  }[];
}

interface DiffFile {
  filename: string;
  old_filename: string | null;
  hunks: DiffHunk[];
}

function parseDiff(diffText: string): DiffFile[] {
  const files: DiffFile[] = [];
  const fileSections = diffText.split(/^diff --git /m).filter(Boolean);

  for (const section of fileSections) {
    // Anchor to end-of-line to avoid greedily matching into subsequent lines
    // on Windows (\r\n) or capturing trailing characters.
    const headerMatch = section.match(/^a\/(.+?) b\/(.+?)\r?$/m);
    if (!headerMatch) continue;

    const oldFilename = headerMatch[1];
    const newFilename = headerMatch[2];

    const hunks: DiffHunk[] = [];
    const hunkRegex = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@.*$/gm;
    let match: RegExpExecArray | null;

    // Store both the header start position (for slicing boundaries) and the
    // body start position (after the @@ line, where hunk content begins).
    const hunkStarts: {
      headerIndex: number;
      index: number;
      old_start: number;
      old_count: number;
      new_start: number;
      new_count: number;
    }[] = [];

    while ((match = hunkRegex.exec(section)) !== null) {
      // Locate the newline that ends the @@ header. If none (the @@ line is
      // the last line with no trailing newline), fall back to section end so
      // we don't overrun and produce a negative-length hunk body.
      const nlIndex = section.indexOf("\n", match.index);
      const bodyIndex = nlIndex === -1 ? section.length : nlIndex + 1;
      hunkStarts.push({
        headerIndex: match.index, // position of the @@ header itself
        index: bodyIndex, // position after the @@ line
        old_start: parseInt(match[1], 10),
        old_count: parseInt(match[2] ?? "1", 10),
        new_start: parseInt(match[3], 10),
        new_count: parseInt(match[4] ?? "1", 10),
      });
    }

    for (let i = 0; i < hunkStarts.length; i++) {
      const start = hunkStarts[i];
      // Use the next hunk's header start (not its body start) as the boundary
      // so we don't include the next @@ line in this hunk's body.
      const end =
        i + 1 < hunkStarts.length
          ? hunkStarts[i + 1].headerIndex
          : section.length;

      const hunkBody = section.substring(start.index, end);
      const lines: DiffHunk["lines"] = [];
      let oldLine = start.old_start;
      let newLine = start.new_start;

      const hunkBodyLines = hunkBody.split("\n");
      for (let li = 0; li < hunkBodyLines.length; li++) {
        // Strip a trailing \r so Windows-style (CRLF) diffs don't leak the
        // carriage return into content or defeat the "\ No newline" sentinel
        // check below.
        const raw = hunkBodyLines[li];
        const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
        // Skip the trailing empty string produced by split("\n") at hunk end.
        if (line === "" && li === hunkBodyLines.length - 1) continue;
        // "\ No newline at end of file" — git marker, not a diff line; skip it.
        if (line === "\\ No newline at end of file") continue;
        if (line.startsWith("+")) {
          lines.push({
            type: "add",
            content: line.substring(1),
            new_line: newLine,
          });
          newLine++;
        } else if (line.startsWith("-")) {
          lines.push({
            type: "remove",
            content: line.substring(1),
            old_line: oldLine,
          });
          oldLine++;
        } else if (line.startsWith(" ")) {
          lines.push({
            type: "context",
            content: line.substring(1),
            old_line: oldLine,
            new_line: newLine,
          });
          oldLine++;
          newLine++;
        }
      }

      hunks.push({
        old_start: start.old_start,
        old_count: start.old_count,
        new_start: start.new_start,
        new_count: start.new_count,
        lines,
      });
    }

    files.push({
      filename: newFilename,
      old_filename: oldFilename !== newFilename ? oldFilename : null,
      hunks,
    });
  }

  return files;
}
