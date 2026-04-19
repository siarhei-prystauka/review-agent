/**
 * Mock data for GitHub API responses used across tests
 */

export const mockPrData = {
  number: 42,
  title: "Add new feature",
  body: "This PR adds a new feature to the application",
  state: "open",
  draft: false,
  user: { login: "testuser" },
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-02T00:00:00Z",
  head: { ref: "feature-branch" },
  base: { ref: "main" },
  labels: [{ name: "enhancement" }, { name: "bug" }],
  requested_reviewers: [{ login: "reviewer1" }],
  additions: 100,
  deletions: 50,
  changed_files: 5,
  mergeable: true,
  html_url: "https://github.com/owner/repo/pull/42",
};

export const mockPrFiles = [
  {
    filename: "src/index.ts",
    status: "modified",
    additions: 50,
    deletions: 20,
    changes: 70,
  },
  {
    filename: "src/utils/helper.ts",
    status: "added",
    additions: 30,
    deletions: 0,
    changes: 30,
  },
  {
    filename: "README.md",
    status: "modified",
    additions: 20,
    deletions: 30,
    changes: 50,
  },
];

export const mockPrCommits = [
  {
    sha: "abc123",
    commit: {
      message: "feat: add new feature",
      author: {
        name: "Test User",
        email: "test@example.com",
        date: "2024-01-01T00:00:00Z",
      },
    },
    author: { login: "testuser" },
  },
  {
    sha: "def456",
    commit: {
      message: "fix: resolve bug",
      author: {
        name: "Test User",
        email: "test@example.com",
        date: "2024-01-02T00:00:00Z",
      },
    },
    author: { login: "testuser" },
  },
];

export const mockDiff = `diff --git a/src/index.ts b/src/index.ts
index abc123..def456 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,5 +1,8 @@
 import { foo } from './foo';

+// New comment
+const bar = 'baz';
+
 function main() {
-  console.log('old');
+  console.log('new');
 }`;

export const mockFileContent = `export function example() {
  return 'test';
}`;

export const mockReviewComments = [
  {
    id: 1,
    path: "src/index.ts",
    line: 5,
    body: "Consider using const instead of let",
    user: { login: "reviewer1" },
  },
];
