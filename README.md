# AI Code Review + Refactoring Assistant

A Claude Code plugin that automatically reviews GitHub Pull Requests, identifies code quality issues, and suggests refactoring improvements.

## Features

- **Automated PR Review** — Analyzes changed files for bugs, security issues, and style violations
- **Refactoring Suggestions** — Identifies structural improvements with before/after code examples
- **GitHub Integration** — Posts review comments directly to PRs with inline annotations
- **Coding Standards** — Enforces configurable team coding standards (STD-NNN references)
- **Parallel Analysis** — Runs code review and refactoring agents simultaneously for speed

## Architecture

```
/review-pr 42
     |
     v
  Skill (orchestration)
     |
     +---> MCP Server (GitHub data access)
     |        |-- get_pr_info, get_pr_diff, get_pr_files
     |        |-- post_review_comment, get_pr_comments
     |        |-- review://standards (coding standards resource)
     |        |-- review_template, refactoring_template (prompts)
     |
     +---> Code Review Agent (bugs, security, style)
     |
     +---> Refactoring Agent (structure, naming, duplication)
     |
     v
  Unified Review Report --> GitHub PR
```

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| MCP Server | `server/` | Structured GitHub PR data access via tools, resources, and prompts |
| Code Reviewer | `agents/code-reviewer.md` | Finds bugs, security vulnerabilities, style violations |
| Refactoring Advisor | `agents/refactoring-advisor.md` | Suggests structural improvements preserving behavior |
| Review Skill | `.claude/skills/review-pr/SKILL.md` | User-facing `/review-pr` command that orchestrates everything |
| Coding Standards | `.claude/skills/review-pr/references/review-standards.md` | Team coding rules referenced by STD-NNN IDs |
| Hooks | `.claude/settings.json` | Post-review notification (Claude Code loads hooks from here, not `hooks/hooks.json`) |

## Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [GitHub CLI](https://cli.github.com/) (`gh`) — authenticated via `gh auth login`
- [Claude Code](https://claude.ai/code) with plugin support

## Setup

```bash
# Install MCP server dependencies
cd server && npm install

# Verify GitHub CLI authentication
gh auth status
```

## Usage

### Basic Review
```
/review-pr 42
```

### Review Without Posting to GitHub
```
/review-pr 42 --no-post
```

### Code Review Only (skip refactoring)
```
/review-pr 42 --review-only
```

### Refactoring Suggestions Only (skip bug detection)
```
/review-pr 42 --refactor-only
```

### Specify Claude Model
Override the Claude model used by each sub-agent (can be combined with other flags):
```
/review-pr 42 --model sonnet
```

### Combined Flags Example
Review only with a specific model:
```
/review-pr 42 --model opus --review-only
```

### Review by URL
```
/review-pr https://github.com/owner/repo/pull/42
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `get_pr_info` | Fetch structured PR metadata |
| `get_pr_diff` | Get parsed per-file diffs with line numbers |
| `get_pr_files` | List changed files with stats |
| `get_pr_commits` | Fetch commit messages, authors, and SHAs |
| `get_file_content` | Read file contents at a specific ref |
| `post_review_comment` | Post review with inline comments |
| `get_pr_comments` | Fetch existing review comments |

## MCP Resources

| URI | Description |
|-----|-------------|
| `review://standards` | Complete coding standards document |
| `review://standards/{category}` | Standards by category (naming, security, etc.) |

## MCP Prompts

| Prompt | Description |
|--------|-------------|
| `review_template` | Structured code review output format |
| `refactoring_template` | Before/after refactoring suggestion format |

## Coding Standards

Standards are defined in `skills/review-pr/references/review-standards.md` and referenced by ID:

- **STD-001 to STD-004**: Naming conventions
- **STD-010 to STD-013**: Error handling
- **STD-020 to STD-023**: Code complexity
- **STD-030 to STD-034**: Security
- **STD-040 to STD-043**: Testing
- **STD-050 to STD-052**: Documentation
- **STD-060 to STD-064**: General patterns

## Project Structure

```
review-agent/
├── .claude-plugin/plugin.json      # Plugin manifest
├── .mcp.json                       # MCP server configuration
├── server/                         # MCP server (TypeScript)
│   ├── src/
│   │   ├── index.ts                # Server entry point
│   │   ├── tools/
│   │   │   ├── pr-tools.ts         # PR data tools
│   │   │   └── review-tools.ts     # Review posting tools
│   │   ├── resources/standards.ts  # Standards resource handler
│   │   └── prompts/review-prompts.ts
│   ├── package.json
│   └── tsconfig.json
├── agents/
│   ├── code-reviewer.md            # Code review subagent
│   └── refactoring-advisor.md      # Refactoring subagent
├── .claude/
│   ├── commands/review-pr.md       # /review-pr slash command
│   ├── skills/review-pr/
│   │   ├── SKILL.md                # /review-pr skill
│   │   └── references/
│   │       └── review-standards.md # Coding standards
│   └── settings.json               # Hook configuration (authoritative location)
├── package.json
├── server-start.cjs
├── CLAUDE.md                       # Project conventions
└── README.md
```

## License

MIT
