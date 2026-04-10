# CLAUDE.md

This file provides guidance to Claude Code when working in the review-agent repository.

## Overview

This is a Claude Code plugin that provides AI-powered code review and refactoring
suggestions for GitHub Pull Requests. It combines an MCP server (for structured
GitHub data access), subagents (for specialized analysis), and skills (for
user-facing orchestration).

## Architecture

- `server/` — TypeScript MCP server providing GitHub PR tools, coding standards
  resources, and review prompt templates. Runs via stdio transport.
- `agents/` — Two specialist agents: code-reviewer (bugs, style) and
  refactoring-advisor (structure, maintainability).
- `skills/` — User-facing command: /review-pr for running reviews.
- `hooks/` — Optional event-driven automation.

## Development Commands

```bash
# Install MCP server dependencies
cd server && npm install

# Test MCP server
cd server && npx tsx src/index.ts

# Verify gh authentication
gh auth status
```

## Coding Standards for This Project

- TypeScript for all server code; use ES modules (import/export)
- Use the `Server` class from `@modelcontextprotocol/sdk`, not FastMCP
- All MCP tool handlers must validate inputs with Zod schemas
- Shell out to `gh api` for GitHub API calls (inherits auth from gh CLI)
- Agent .md files must include example blocks in descriptions
- Skills use $ARGUMENTS for user input
- Coding standards IDs follow pattern STD-NNN
- All review findings must include file:line references

## Critical Guidance

- Never store GitHub tokens in code — use gh CLI's authenticated session
- MCP tools return structured JSON, not raw CLI output
- Agents must score findings by confidence (0-100) and filter below threshold 75
- The refactoring-advisor must never suggest behavioral changes
- Review comments posted to GitHub must include line references when possible
