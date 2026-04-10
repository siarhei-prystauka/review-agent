import { z } from "zod";
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
          .describe("Line number in the diff to attach the comment to"),
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

export const reviewTools = [
  {
    name: "post_review_comment",
    description:
      "Post a review on a PR with an optional list of inline file-level comments. Supports COMMENT, APPROVE, and REQUEST_CHANGES events. Inline comments require path, line, side (LEFT or RIGHT), and body.",
    inputSchema: {
      type: "object" as const,
      properties: {
        owner: { type: "string", description: "Repository owner" },
        repo: { type: "string", description: "Repository name" },
        pr_number: { type: "number", description: "Pull request number" },
        body: { type: "string", description: "Main review comment body" },
        event: {
          type: "string",
          enum: ["COMMENT", "APPROVE", "REQUEST_CHANGES"],
          description: "Review action",
        },
        comments: {
          type: "array",
          description: "Optional inline comments",
          items: {
            type: "object",
            properties: {
              path: { type: "string", description: "File path" },
              line: { type: "number", description: "Line number in the diff" },
              side: {
                type: "string",
                enum: ["LEFT", "RIGHT"],
                description:
                  "RIGHT for the new file (additions), LEFT for the old file (deletions). Defaults to RIGHT.",
              },
              body: { type: "string", description: "Comment text" },
            },
            required: ["path", "line", "body"],
          },
        },
      },
      required: ["owner", "repo", "pr_number", "body", "event"],
    },
    handler: async (args: unknown) => {
      const { owner, repo, pr_number, body, event, comments } =
        PostReviewSchema.parse(args);

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
      return {
        id: result.id,
        state: result.state,
        html_url: result.html_url,
        submitted_at: result.submitted_at,
      };
    },
  },
  {
    name: "get_pr_comments",
    description:
      "Fetch existing review comments on a PR to understand prior feedback and avoid duplicate comments.",
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
      const raw = await ghExec([
        "api",
        `repos/${owner}/${repo}/pulls/${pr_number}/comments`,
        "--paginate",
      ]);
      // gh --paginate concatenates pages as [...][...]; merge into a single array.
      const comments = JSON.parse(raw.replace(/\]\s*\[/g, ","));
      return comments.map(
        (c: {
          id: number;
          user: { login: string };
          body: string;
          path: string;
          line: number;
          side: string;
          created_at: string;
        }) => ({
          id: c.id,
          author: c.user?.login,
          body: c.body,
          path: c.path,
          line: c.line,
          side: c.side,
          created_at: c.created_at,
        })
      );
    },
  },
];
