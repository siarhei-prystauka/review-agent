# Test Suite

This directory contains the automated test suite for the review-agent MCP server.

## Structure

```
__tests__/
├── utils/                  # Unit tests for utility functions
│   └── schemas.test.ts    # Zod schema validation tests
├── unit/                   # Unit tests for server components
│   └── server.test.ts     # MCP server initialization and registration
└── README.md              # This file
```

## Test Types

### Unit Tests (`utils/`)

Test individual functions and modules in isolation:

- **schemas.test.ts** — Tests Zod schema validation for PR identifiers
  - Validates correct input formats
  - Rejects invalid inputs (negative numbers, non-integers, empty strings)
  - Tests edge cases (missing fields)

### Unit Tests (`unit/`)

Test server components and tool registration:

- **server.test.ts** — Tests server initialization and tool registration
  - Server creates successfully with correct configuration
  - PR tools register without errors
  - Review tools register without errors
  - All tools can be registered together

## Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode (auto-rerun on file changes)
npm run test:watch
```

## Writing New Tests

### Test File Naming

- Unit tests: `<module-name>.test.ts`
- End-to-end tests: `<feature>.test.ts`

### Test Structure

```typescript
import { describe, it, expect } from "@jest/globals";

describe("Feature name", () => {
  it("should do something specific", () => {
    // Arrange
    const input = "test";

    // Act
    const result = functionUnderTest(input);

    // Assert
    expect(result).toBe("expected");
  });
});
```

## Test Coverage

Coverage reports are generated in `../coverage/`:

- `coverage/lcov.info` — Machine-readable format for CI
- `coverage/html/` — Human-readable HTML report

View HTML coverage report:
```bash
npm run test:coverage
open coverage/html/index.html  # macOS
xdg-open coverage/html/index.html  # Linux
start coverage/html/index.html  # Windows
```

## CI/CD Integration

Tests run automatically on:
- All pull requests
- Pushes to main/master branches
- Multiple Node.js versions (18.x, 20.x, 22.x)

See `.github/workflows/ci.yml` for workflow configuration.

## Testing Philosophy

1. **Test behavior, not implementation** — Tests should verify what the code does, not how it does it
2. **Keep tests simple** — Each test should verify one specific behavior
3. **Use descriptive test names** — Test names should clearly describe the scenario being tested
4. **Avoid testing MCP SDK internals** — Focus on our code, not the SDK's behavior
5. **Mock external dependencies** — Tests should not make real GitHub API calls

## Limitations

Due to the MCP SDK's architecture, we cannot easily test:

- Actual tool execution with real GitHub API calls (would require integration testing with live data)
- MCP protocol message handling (SDK internals)
- Server-client communication (requires full transport setup)

These aspects are tested through:
- Manual testing via `/review-pr` command
- Real-world usage in development
- The build process (ensures TypeScript compilation succeeds)