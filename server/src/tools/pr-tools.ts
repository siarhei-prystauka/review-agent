import { z } from "zod";
import { ghExec } from "../utils/gh.js";

const PrIdentifierSchema = z.object({
  owner: z.string().describe("Repository owner (e.g., 'octocat')"),
  repo: z.string().describe("Repository name (e.g., 'hello-world')"),
  pr_number: z.number().int().positive().describe("Pull request number"),
});

async function ghApi(endpoint: string): Promise<string> {
  return ghExec(["api", endpoint, "--paginate"]);
}

// --paginate is intentionally omitted: the diff Accept header returns raw text,
// not a JSON array, so gh's pagination logic does not apply here.
async function ghApiRaw(endpoint: string, accept: string): Promise<string> {
  return ghExec(["api", endpoint, "-H", `Accept: ${accept}`]);
}

export const prTools = [
  {
    name: "get_pr_info",
    description:
      "Fetch structured metadata for a pull request including title, description, author, state, labels, and reviewers.",
    inputSchema: {
      type: "object" as const,
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" },
        pr_number: { type: "number", description: "Pull request number" },
      },
      required: ["owner", "repo", "pr_number"],
    },
    handler: async (args: unknown) => {
      const { owner, repo, pr_number } = PrIdentifierSchema.parse(args);
      const raw = await ghApi(`repos/${owner}/${repo}/pulls/${pr_number}`);
      const pr = JSON.parse(raw);
      return {
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
    },
  },
  {
    name: "get_pr_diff",
    description:
      "Fetch the PR diff parsed into per-file change objects with hunks, added/removed lines, and line numbers. Returns structured, machine-readable diff data.",
    inputSchema: {
      type: "object" as const,
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" },
        pr_number: { type: "number", description: "Pull request number" },
      },
      required: ["owner", "repo", "pr_number"],
    },
    handler: async (args: unknown) => {
      const { owner, repo, pr_number } = PrIdentifierSchema.parse(args);
      const raw = await ghApiRaw(
        `repos/${owner}/${repo}/pulls/${pr_number}`,
        "application/vnd.github.v3.diff"
      );
      return parseDiff(raw);
    },
  },
  {
    name: "get_pr_files",
    description:
      "List all changed files in a PR with their change types (added, modified, deleted, renamed) and patch statistics.",
    inputSchema: {
      type: "object" as const,
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" },
        pr_number: { type: "number", description: "Pull request number" },
      },
      required: ["owner", "repo", "pr_number"],
    },
    handler: async (args: unknown) => {
      const { owner, repo, pr_number } = PrIdentifierSchema.parse(args);
      const raw = await ghApi(
        `repos/${owner}/${repo}/pulls/${pr_number}/files`
      );
      const files = JSON.parse(raw);
      return files.map(
        (f: {
          filename: string;
          status: string;
          additions: number;
          deletions: number;
          changes: number;
          previous_filename?: string;
        }) => ({
          filename: f.filename,
          status: f.status,
          additions: f.additions,
          deletions: f.deletions,
          changes: f.changes,
          previous_filename: f.previous_filename ?? null,
        })
      );
    },
  },
  {
    name: "get_pr_commits",
    description:
      "Fetch the list of commits in a pull request, including commit messages, authors, and timestamps. Useful for understanding the change history and commit quality.",
    inputSchema: {
      type: "object" as const,
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" },
        pr_number: { type: "number", description: "Pull request number" },
      },
      required: ["owner", "repo", "pr_number"],
    },
    handler: async (args: unknown) => {
      const { owner, repo, pr_number } = PrIdentifierSchema.parse(args);
      const raw = await ghApi(
        `repos/${owner}/${repo}/pulls/${pr_number}/commits`
      );
      const commits = JSON.parse(raw);
      return commits.map(
        (c: {
          sha: string;
          commit: {
            message: string;
            author: { name: string; date: string };
          };
          author?: { login: string };
        }) => ({
          sha: c.sha.substring(0, 8),
          message: c.commit.message,
          author: c.author?.login ?? c.commit.author?.name,
          date: c.commit.author?.date,
        })
      );
    },
  },
  {
    name: "get_file_content",
    description:
      "Fetch the content of a file from a GitHub repository at a specific ref (branch, tag, or commit SHA). Use this to read CLAUDE.md, configuration files, or any source file from the PR's repository.",
    inputSchema: {
      type: "object" as const,
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" },
        path: {
          type: "string",
          description: "File path relative to repo root (e.g., 'CLAUDE.md')",
        },
        ref: {
          type: "string",
          description:
            "Branch, tag, or commit SHA to read from. Defaults to the default branch.",
        },
      },
      required: ["owner", "repo", "path"],
    },
    handler: async (args: unknown) => {
      const { owner, repo, path, ref } = z
        .object({
          owner: z.string(),
          repo: z.string(),
          path: z
            .string()
            .refine(
              (p) => !p.startsWith("/") && !p.includes(".."),
              "Path must be relative and must not contain '..'"
            ),
          ref: z.string().optional(),
        })
        .parse(args);

      const endpoint =
        `repos/${owner}/${repo}/contents/${path}` +
        (ref ? `?ref=${encodeURIComponent(ref)}` : "");

      const raw = await ghExec(["api", endpoint]);
      const data = JSON.parse(raw);

      if (data.type !== "file") {
        throw new Error(`Path "${path}" is not a file (type: ${data.type})`);
      }

      const content = Buffer.from(data.content, "base64").toString("utf-8");
      return { path, ref: data.sha, size: data.size, content };
    },
  },
];

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
      hunkStarts.push({
        headerIndex: match.index, // position of the @@ header itself
        index: match.index + match[0].length + 1, // position after the @@ line
        old_start: parseInt(match[1]),
        old_count: parseInt(match[2] ?? "1"),
        new_start: parseInt(match[3]),
        new_count: parseInt(match[4] ?? "1"),
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
        const line = hunkBodyLines[li];
        // Skip the trailing empty string produced by split("\n") at hunk end.
        if (line === "" && li === hunkBodyLines.length - 1) continue;
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
