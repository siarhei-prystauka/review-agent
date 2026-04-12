import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Validates prompt args to prevent injection via crafted argument values.
const ownerRepoSchema = z.string().regex(/^[a-zA-Z0-9._-]+$/);
const prNumberSchema = z.string().regex(/^\d+$/);
const focusAreaSchema = z
  .enum(["security", "performance", "style", "bugs", "all"])
  .optional();
const filenameSchema = z
  .string()
  .regex(/^[a-zA-Z0-9._/\-]+$/)
  .optional();

export function registerReviewPrompts(server: McpServer): void {
  server.registerPrompt(
    "review_template",
    {
      description:
        "A structured prompt template for performing a code review on a pull request. Ensures consistent output format with severity levels and actionable feedback.",
      argsSchema: {
        owner: ownerRepoSchema.describe("Repository owner (e.g., 'octocat')"),
        repo: ownerRepoSchema.describe("Repository name (e.g., 'hello-world')"),
        pr_number: prNumberSchema.describe("The pull request number to review"),
        focus_area: focusAreaSchema.describe(
          "Optional focus area: 'security', 'performance', 'style', 'bugs', or 'all'"
        ),
      },
    },
    ({ owner, repo, pr_number, focus_area }) => {
      const focusArea = focus_area ?? "all";
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Review pull request #${pr_number} in ${owner}/${repo} with focus on: ${focusArea}.

## Instructions

1. Fetch the PR diff using: mcp__review-agent__get_pr_diff with owner="${owner}", repo="${repo}", pr_number=${pr_number}
2. Read the coding standards from the review://standards resource
3. For each changed file, analyze the changes for issues

## Output Format

For each finding, use this structure:

### [SEVERITY] Title
- **File**: \`path/to/file.ts:LINE\`
- **Standard**: STD-NNN (reference to violated standard)
- **Description**: Clear explanation of the issue
- **Suggestion**: How to fix it
- **Confidence**: N/100

Severity levels:
- **CRITICAL**: Bugs, security vulnerabilities, data loss risks
- **IMPORTANT**: Logic issues, missing error handling, bad patterns
- **SUGGESTION**: Style improvements, minor optimizations, readability

Only report findings with confidence >= 75.
End with a summary: total findings by severity, overall recommendation (APPROVE / REQUEST_CHANGES / COMMENT).`,
            },
          },
        ],
      };
    }
  );

  server.registerPrompt(
    "refactoring_template",
    {
      description:
        "A structured prompt template for suggesting refactoring improvements. Produces before/after code comparisons with rationale and risk assessment.",
      argsSchema: {
        owner: ownerRepoSchema.describe("Repository owner (e.g., 'octocat')"),
        repo: ownerRepoSchema.describe("Repository name (e.g., 'hello-world')"),
        pr_number: prNumberSchema.describe("The pull request number to analyze"),
        filename: filenameSchema.describe(
          "Optional specific file to focus refactoring suggestions on"
        ),
      },
    },
    ({ owner, repo, pr_number, filename }) => {
      const fileScope = filename
        ? `Focus specifically on \`${filename}\`.`
        : "Analyze all changed files.";
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Suggest refactoring improvements for pull request #${pr_number} in ${owner}/${repo}. ${fileScope}

## Instructions

1. Fetch the PR diff using: mcp__review-agent__get_pr_diff with owner="${owner}", repo="${repo}", pr_number=${pr_number}
2. Read full source files for context using: mcp__review-agent__get_file_content with owner="${owner}", repo="${repo}"
3. Identify structural improvements that preserve behavior

## Output Format

For each suggestion:

### Suggestion N: Title
- **File**: \`path/to/file.ts:LINE-LINE\`
- **Category**: Duplication | Complexity | Naming | Decomposition | Dead Code | Pattern
- **Risk**: Safe | Moderate | Risky
- **Effort**: Trivial | Small | Medium

**Before:**
\`\`\`
current code
\`\`\`

**After:**
\`\`\`
suggested code
\`\`\`

**Rationale**: Why this improves the code
**Skip if**: When this suggestion should be ignored

Prioritize by impact-to-effort ratio. Never suggest changes that alter behavior.`,
            },
          },
        ],
      };
    }
  );
}
