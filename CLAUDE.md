# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a Claude Code plugin that provides AI-powered code review and refactoring suggestions for GitHub Pull Requests. It combines an MCP server (for structured GitHub data access), subagents (for specialized analysis), and a skill (for user-facing orchestration).

## Architecture

```
/review-pr 42
    └── skills/review-pr/SKILL.md          # orchestrates the flow
            ├── Agent: code-reviewer       # bugs, security, style
            ├── Agent: refactoring-advisor # structure, maintainability
            └── MCP: review-agent server   # GitHub data + standards + prompts
                    ├── tools/pr-tools.ts          # read-only PR data
                    ├── tools/review-tools.ts      # post reviews / read comments
                    ├── resources/standards.ts     # review://standards/* URIs
                    └── prompts/review-prompts.ts  # review_template / refactoring_template
```

- **Plugin manifest**: `.claude-plugin/plugin.json` — registers the plugin name/author.
- **MCP config**: `.mcp.json` — registers the server; entry point is `server/src/index.ts` via `npx tsx`.
- **Hooks**: `.claude/settings.json` — `PostToolUse` hook on `mcp__review-agent__post_review_comment` prints a success message. There is no `hooks/` directory; hooks live here.

## Development Commands

```bash
# Install MCP server dependencies
cd server && npm install

# Compile TypeScript (outputs to server/dist/)
cd server && npm run build

# Run MCP server manually for debugging (stdio transport)
cd server && npx tsx src/index.ts

# Verify gh authentication
gh auth status
```

There are no automated tests. Manual testing is done by running the skill via `/review-pr`.

## Server Internals

`server/src/index.ts` creates a single `Server` instance and wires all handlers. Tool calls dispatch to `pr-tools.ts` or `review-tools.ts` by tool name. Resources and prompts are handled via `standards.ts` and `review-prompts.ts`.

**`server/src/utils/gh.ts`** — `ghExec(args, options)` wraps `gh` CLI with a 30s timeout and 10MB buffer. All GitHub API calls go through this function so auth is inherited from the user's `gh` session — never passed as a parameter.

**`server/src/utils/schemas.ts`** — `PrIdentifierSchema` (owner, repo, pr_number) is the shared Zod schema reused across all PR tools. Add new shared schemas here.

**`server/src/tools/pr-tools.ts`** — Five read-only tools: `get_pr_info`, `get_pr_diff`, `get_pr_files`, `get_pr_commits`, `get_file_content`. `get_pr_diff` runs a custom `parseDiff()` that converts raw `gh api` diff text into structured per-file objects with typed hunk arrays and accurate line numbers.

**`server/src/tools/review-tools.ts`** — `post_review_comment` caps inline comments at 100 (appends a note if truncated). `get_pr_comments` is used by agents to avoid duplicate findings.

**`server/src/resources/standards.ts`** — Loads `skills/review-pr/references/review-standards.md` once at startup and caches it. Serves two URI patterns:
- `review://standards` — full document
- `review://standards/{category}` — extracts a section by heading (e.g., `review://standards/security` → the Security section)

**`server/src/prompts/review-prompts.ts`** — Input args are validated with regexes before the prompt is built. `OWNER_REPO_RE`, `PR_NUMBER_RE`, `FOCUS_AREA_ALLOWED`, and `FILENAME_RE` are the guards. Prompts instruct agents to call MCP tools and read standards; they do not contain the review logic itself.

## Skill Workflow

`skills/review-pr/SKILL.md` orchestrates five steps:

1. Parse `$ARGUMENTS` — accept PR number or full GitHub URL; detect repo from `gh repo view` if only a number is given.
2. Validate PR is open via `gh pr view`.
3. Launch `code-reviewer` and `refactoring-advisor` agents **in parallel** (unless `--review-only` or `--refactor-only` is passed). If one fails, continue with the other.
4. Aggregate findings into a unified report.
5. If `--post` was passed, call `post_review_comment`; otherwise prompt the user for confirmation.

## Agent Responsibilities

| Agent | File | Scope |
|---|---|---|
| code-reviewer | `agents/code-reviewer.md` | Bugs, security, error handling, style — reports findings ≥ 75 confidence |
| refactoring-advisor | `agents/refactoring-advisor.md` | Duplication, complexity, naming, dead code — **never** behavioral changes |

Both agents: load standards from `review://standards`, call `get_file_content` for full context, limit analysis to top 20 files by change count on large PRs, and include `file:line` references and `STD-NNN` IDs in every finding.

## Coding Standards for This Project

- TypeScript for all server code; use ES modules (`import`/`export`)
- Use the `Server` class from `@modelcontextprotocol/sdk`, not FastMCP
- All MCP tool handlers must validate inputs with Zod schemas
- Shell out via `ghExec()` for all GitHub API calls — never pass tokens directly
- Agent `.md` files must include example blocks in their descriptions
- Skills use `$ARGUMENTS` for user input
- Coding standards IDs follow pattern `STD-NNN`
- All review findings must include `file:line` references

## Critical Guidance

- Never store GitHub tokens in code — use `gh` CLI's authenticated session
- MCP tools return structured JSON, not raw CLI output
- Agents must score findings by confidence (0–100) and filter below threshold 75
- The refactoring-advisor must never suggest behavioral changes
- Review comments posted to GitHub must include line references when possible
