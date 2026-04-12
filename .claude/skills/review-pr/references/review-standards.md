# Coding Standards for Code Review

These standards are referenced by ID (STD-NNN) in review findings.

## Naming Conventions

**STD-001**: Use descriptive, intention-revealing names. Avoid single-letter variables except in short loops or lambdas.

**STD-002**: Use consistent casing conventions: camelCase for variables/functions, PascalCase for classes/types/components, UPPER_SNAKE_CASE for constants.

**STD-003**: Boolean variables and functions should read as questions: `isValid`, `hasPermission`, `canEdit`, `shouldRetry`.

**STD-004**: Avoid redundant prefixes or type encoding in names. Prefer `users` over `userList`, `count` over `intCount`.

## Error Handling

**STD-010**: Never swallow errors silently. All catch blocks must either handle the error meaningfully, re-throw, or log with context.

**STD-011**: Use specific error types where possible. Avoid throwing plain strings or generic `Error` without context.

**STD-012**: Validate inputs at system boundaries (API endpoints, user input, external data). Internal function calls between trusted code do not need redundant validation.

**STD-013**: Async operations must have error handling. Unhandled promise rejections are bugs.

## Code Complexity

**STD-020**: Functions should do one thing. If a function name contains "and", consider splitting it.

**STD-021**: Limit nesting depth to 3 levels. Use early returns, guard clauses, or extraction to reduce nesting.

**STD-022**: Functions should be under 40 lines. Beyond that, consider extracting helper functions.

**STD-023**: Limit function parameters to 3. Use an options object for more.

## Security

**STD-030**: Never hardcode secrets, API keys, or credentials in source code.

**STD-031**: Sanitize and validate all user input before use. Be especially careful with data used in SQL queries, HTML rendering, shell commands, and file paths.

**STD-032**: Use parameterized queries for database operations. Never concatenate user input into query strings.

**STD-033**: Apply the principle of least privilege. Request only the permissions needed.

**STD-034**: Do not log sensitive data (passwords, tokens, PII).

## Testing

**STD-040**: New features and bug fixes should include tests. Untested code is a risk.

**STD-041**: Tests should be independent and not rely on execution order or shared mutable state.

**STD-042**: Test names should describe the behavior being tested, not the implementation.

**STD-043**: Avoid testing implementation details. Test behavior and outcomes.

## Documentation

**STD-050**: Public APIs must have documentation describing purpose, parameters, return values, and thrown errors.

**STD-051**: Add comments only where the logic is non-obvious. Don't comment what the code already says.

**STD-052**: Keep TODO comments actionable with context: `TODO(author): description - tracking issue #NNN`.

## General Patterns

**STD-060**: Don't Repeat Yourself (DRY) — if the same logic appears 3+ times, extract it.

**STD-061**: Prefer immutability. Use `const` by default; avoid mutating function arguments.

**STD-062**: Avoid premature optimization. Write clear code first; optimize when measured.

**STD-063**: Remove dead code. Commented-out code and unused imports are noise.

**STD-064**: Follow the existing patterns in the codebase. Consistency matters more than personal preference.
