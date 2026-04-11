export const reviewPrompts = [
  {
    name: "review_template",
    description:
      "A structured prompt template for performing a code review on a pull request. Ensures consistent output format with severity levels and actionable feedback.",
    arguments: [
      {
        name: "owner",
        description: "Repository owner (e.g., 'octocat')",
        required: true,
      },
      {
        name: "repo",
        description: "Repository name (e.g., 'hello-world')",
        required: true,
      },
      {
        name: "pr_number",
        description: "The pull request number to review",
        required: true,
      },
      {
        name: "focus_area",
        description:
          "Optional focus area: 'security', 'performance', 'style', 'bugs', or 'all'",
        required: false,
      },
    ],
  },
  {
    name: "refactoring_template",
    description:
      "A structured prompt template for suggesting refactoring improvements. Produces before/after code comparisons with rationale and risk assessment.",
    arguments: [
      {
        name: "owner",
        description: "Repository owner (e.g., 'octocat')",
        required: true,
      },
      {
        name: "repo",
        description: "Repository name (e.g., 'hello-world')",
        required: true,
      },
      {
        name: "pr_number",
        description: "The pull request number to analyze",
        required: true,
      },
      {
        name: "filename",
        description: "Optional specific file to focus refactoring suggestions on",
        required: false,
      },
    ],
  },
];

// Validates prompt args to prevent injection via crafted argument values.
const OWNER_REPO_RE = /^[a-zA-Z0-9._-]+$/;
const PR_NUMBER_RE = /^\d+$/;
const FOCUS_AREA_ALLOWED = new Set(["security", "performance", "style", "bugs", "all"]);
// filename is inserted into prompt text only — restrict to safe path characters.
const FILENAME_RE = /^[a-zA-Z0-9._/\-]+$/;

function validatePromptArgs(args: Record<string, string>): void {
  if (args.owner && !OWNER_REPO_RE.test(args.owner)) {
    throw new Error(`Invalid owner: "${args.owner}"`);
  }
  if (args.repo && !OWNER_REPO_RE.test(args.repo)) {
    throw new Error(`Invalid repo: "${args.repo}"`);
  }
  if (args.pr_number && !PR_NUMBER_RE.test(args.pr_number)) {
    throw new Error(`Invalid pr_number: "${args.pr_number}"`);
  }
  if (args.focus_area && !FOCUS_AREA_ALLOWED.has(args.focus_area)) {
    throw new Error(
      `Invalid focus_area: "${args.focus_area}". Must be one of: security, performance, style, bugs, all`
    );
  }
  if (args.filename && !FILENAME_RE.test(args.filename)) {
    throw new Error(`Invalid filename: "${args.filename}"`);
  }
}

export function getPromptMessages(
  name: string,
  args: Record<string, string>
): { role: string; content: { type: string; text: string } }[] {
  validatePromptArgs(args);

  if (name === "review_template") {
    const focusArea = args.focus_area || "all";
    return [
      {
        role: "user",
        content: {
          type: "text",
          text: `Review pull request #${args.pr_number} in ${args.owner}/${args.repo} with focus on: ${focusArea}.

## Instructions

1. Fetch the PR diff using: mcp__review-agent__get_pr_diff with owner="${args.owner}", repo="${args.repo}", pr_number=${args.pr_number}
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
    ];
  }

  if (name === "refactoring_template") {
    const fileScope = args.filename
      ? `Focus specifically on \`${args.filename}\`.`
      : "Analyze all changed files.";
    return [
      {
        role: "user",
        content: {
          type: "text",
          text: `Suggest refactoring improvements for pull request #${args.pr_number} in ${args.owner}/${args.repo}. ${fileScope}

## Instructions

1. Fetch the PR diff using: mcp__review-agent__get_pr_diff with owner="${args.owner}", repo="${args.repo}", pr_number=${args.pr_number}
2. Read full source files for context using: mcp__review-agent__get_file_content with owner="${args.owner}", repo="${args.repo}"
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
    ];
  }

  throw new Error(`Unknown prompt: ${name}`);
}
