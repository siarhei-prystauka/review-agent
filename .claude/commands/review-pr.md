---
description: "Review a GitHub pull request for code quality issues and refactoring opportunities. Orchestrates code-reviewer and refactoring-advisor agents."
argument-hint: "<pr-number-or-url> [--no-post] [--review-only] [--refactor-only] [--model <sonnet|opus|haiku>]"
allowed-tools: Bash(gh *), Read, Glob, Grep, Agent
---

# PR Review & Refactoring Assistant

You are orchestrating a comprehensive code review of a pull request. You will coordinate specialized agents to analyze code quality and suggest improvements.

## Arguments

The user invoked this skill with: $ARGUMENTS

Parse the arguments:
- First argument: PR number (e.g., `42`) or full GitHub URL (e.g., `https://github.com/owner/repo/pull/42`)
- `--no-post`: Skip posting the review to GitHub; display the report only
- `--review-only`: Only run the code review agent, skip refactoring
- `--refactor-only`: Only run the refactoring agent, skip code review
- `--model <sonnet|opus|haiku>`: Override the Claude model for launched agents

If `--model` is provided, validate the value is one of `sonnet`, `opus`, or `haiku`. If invalid, show an error and stop.

## Step 1: Parse and Validate

Extract the PR number from the arguments. If a URL was provided, parse out the owner, repo, and PR number.

If only a number was provided, detect the current repository:
```bash
gh repo view --json owner,name -q '.owner.login + "/" + .name'
```

Then validate the PR exists and is open:
```bash
gh pr view <number> --json state,isDraft,title,author,url,number,headRefName,baseRefName
```

If the PR is closed or merged, inform the user and stop.
If the PR is a draft, warn but continue.

Display a summary:
```
Reviewing PR #<number>: <title>
Author: <author> | Branch: <head> → <base> | State: <state>
```

## Step 2: Gather Context

Fetch the list of changed files to understand the PR scope:
```bash
gh pr view <number> --json files -q '.files[].path'
```

Report the scope:
```
Files changed: <count>
<list of filenames>
```

## Step 3: Launch Review Agents

Launch the specialized agents based on the flags provided.
If `--model` was provided, include `model: <value>` in each Agent tool call.

**Default (no flags) or both needed:**
Launch BOTH agents in parallel using the Agent tool:

1. **code-reviewer** agent: "Review PR #<number> in <owner>/<repo> for bugs, security issues, and style violations. The PR changes these files: <file list>. Use the MCP tools mcp__review-agent__get_pr_diff and mcp__review-agent__get_pr_files to fetch the diff. Read the review://standards resource for coding standards."

2. **refactoring-advisor** agent: "Analyze PR #<number> in <owner>/<repo> for refactoring opportunities. The PR changes these files: <file list>. Use the MCP tools mcp__review-agent__get_pr_diff and mcp__review-agent__get_pr_files to fetch the diff. Focus on structural improvements that preserve behavior."

**With `--review-only`:** Launch only the code-reviewer agent.
**With `--refactor-only`:** Launch only the refactoring-advisor agent.

If an agent fails (e.g., MCP tool error, rate limit, network issue): include an error notice in that section of the report ("Code review failed: {error message}") and continue with the other agent's results. Do not abort the entire review because one agent failed.

## Step 4: Aggregate Results

Once all launched agents complete (or fail), compile their findings into a unified report:

```markdown
# PR Review Report: #<number> — <title>

## Overview
- **Author**: <author>
- **Branch**: <head> → <base>
- **Files Changed**: <count>
- **Review Date**: <current date>

---

## Code Review Findings

<Insert code-reviewer agent results here>

---

## Refactoring Suggestions

<Insert refactoring-advisor agent results here>

---

## Final Recommendation

<Based on the findings:>
<- If critical issues found: **REQUEST_CHANGES** with explanation>
<- If only suggestions: **COMMENT** with summary>
<- If code is clean: **APPROVE** with praise>
```

## Step 5: Post to GitHub

Use the `mcp__review-agent__post_review_comment` MCP tool to post the review:
- Set `body` to the full aggregated review report
- Set `event` to:
  - `REQUEST_CHANGES` if critical issues were found
  - `COMMENT` if only non-critical findings
  - `APPROVE` if no issues found
- Include inline `comments` array for each finding that has a specific file:line reference

If the `--no-post` flag was provided, skip this step and only display the report.

## Important Notes

- Always run agents in parallel when both are needed — this saves time.
- The agents use MCP tools (mcp__review-agent__*) to access PR data. These tools provide structured JSON responses.
- The review://standards resource provides the team's coding standards that agents reference by ID (STD-NNN).
- If a PR has no code changes (only docs, configs), mention that and provide a lighter review.
