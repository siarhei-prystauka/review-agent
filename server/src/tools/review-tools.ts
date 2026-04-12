import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ghExec } from "../utils/gh.js";
import { PrIdentifierSchema } from "../utils/schemas.js";

const MAX_INLINE_COMMENTS = 100;

const PostReviewSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  pr_number: z.number().int().positive(),
  body: z.string().describe("The main review comment body"),
  event: z
    .enum(["COMMENT", "APPROVE", "REQUEST_CHANGES"])
    .describe("The review action"),
  comments: z
    .array(
      z.object({
        path: z.string().describe("File path relative to repo root"),
        line: z
          .number()
          .int()
          .positive()
          .describe("Line number in the file (on the specified side) to attach the comment to"),
        side: z
          .enum(["LEFT", "RIGHT"])
          .default("RIGHT")
          .describe(
            "Which side of the diff: RIGHT for the new file (additions), LEFT for the old file (deletions)"
          ),
        body: z.string().describe("Inline comment text"),
      })
    )
    .optional()
    .describe("Optional inline comments on specific lines"),
});

export function registerReviewTools(server: McpServer): void {
  server.registerTool(
    "post_review_comment",
    {
      description:
        "Post a review on a PR with an optional list of inline file-level comments. Supports COMMENT, APPROVE, and REQUEST_CHANGES events. Inline comments require path, line, side (LEFT or RIGHT), and body.",
      inputSchema: PostReviewSchema.shape,
    },
    async ({ owner, repo, pr_number, body, event, comments }) => {
      const payload: Record<string, unknown> = { body, event };
      if (comments && comments.length > 0) {
        let inlineComments = comments;
        let truncationNote = "";
        if (inlineComments.length > MAX_INLINE_COMMENTS) {
          inlineComments = inlineComments.slice(0, MAX_INLINE_COMMENTS);
          truncationNote = `\n\n> **Note**: ${comments.length - MAX_INLINE_COMMENTS} inline comment(s) were omitted because the GitHub API limit of ${MAX_INLINE_COMMENTS} inline comments per review was reached.`;
        }
        payload.body = body + truncationNote;
        payload.comments = inlineComments.map((c) => ({
          path: c.path,
          line: c.line,
          side: c.side,
          body: c.body,
        }));
      }

      const stdout = await ghExec(
        [
          "api",
          `repos/${owner}/${repo}/pulls/${pr_number}/reviews`,
          "-X",
          "POST",
          "--input",
          "-",
        ],
        { input: JSON.stringify(payload) }
      );

      const result = JSON.parse(stdout);
      const response = {
        id: result.id,
        state: result.state,
        html_url: result.html_url,
        submitted_at: result.submitted_at,
      };
      return { content: [{ type: "text", text: JSON.stringify(response, null, 2) }] };
    }
  );

  server.registerTool(
    "get_pr_comments",
    {
      description:
        "Fetch existing review comments on a PR to understand prior feedback and avoid duplicate comments.",
      inputSchema: PrIdentifierSchema.shape,
    },
    async ({ owner, repo, pr_number }) => {
      const raw = await ghExec([
        "api",
        `repos/${owner}/${repo}/pulls/${pr_number}/comments`,
        "--paginate",
      ]);
      // gh --paginate concatenates pages as [...][...]; merge into a single array.
      const comments = JSON.parse(raw.replace(/\]\s*\[/g, ","));
      const result = comments.map(
        (c: {
          id: number;
          user: { login: string } | null;
          body: string;
          path: string;
          line: number | null;
          side: string;
          created_at: string;
        }) => ({
          id: c.id,
          author: c.user?.login ?? null,
          body: c.body,
          path: c.path,
          line: c.line ?? null,
          side: c.side,
          created_at: c.created_at,
        })
      );
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
