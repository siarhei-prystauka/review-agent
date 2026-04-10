import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Path is resolved relative to this compiled file's location.
// The MCP server is expected to be run from server/ with the project root one level up.
// If the standards file is moved, update this path accordingly.
const STANDARDS_PATH = join(
  __dirname,
  "..",
  "..",
  "..",
  "skills",
  "review-pr",
  "references",
  "review-standards.md"
);

// Module-level cache — loaded once per server process.
// To pick up changes to the standards file, restart the MCP server.
let standardsCache: string | null = null;

async function loadStandards(): Promise<string> {
  if (!standardsCache) {
    standardsCache = await readFile(STANDARDS_PATH, "utf-8");
  }
  return standardsCache;
}

function extractCategory(
  standards: string,
  category: string
): string | null {
  const regex = new RegExp(
    `^## ${category}\\b[^\\n]*\\n([\\s\\S]*?)(?=^## |$)`,
    "mi"
  );
  const match = standards.match(regex);
  return match ? match[0].trim() : null;
}

export const standardsResources = [
  {
    uri: "review://standards",
    name: "Coding Standards",
    description:
      "Complete coding standards and review guidelines used by the review agents.",
    mimeType: "text/markdown",
  },
];

export const standardsResourceTemplates = [
  {
    uriTemplate: "review://standards/{category}",
    name: "Coding Standards by Category",
    description:
      "Specific category of coding standards (e.g., naming, security, error-handling, testing, complexity, documentation).",
    mimeType: "text/markdown",
  },
];

export async function readStandardsResource(
  uri: string
): Promise<{ uri: string; mimeType: string; text: string }> {
  const standards = await loadStandards();

  if (uri === "review://standards") {
    return { uri, mimeType: "text/markdown", text: standards };
  }

  const categoryMatch = uri.match(/^review:\/\/standards\/(.+)$/);
  if (categoryMatch) {
    const category = categoryMatch[1]
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    const section = extractCategory(standards, category);
    if (section) {
      return { uri, mimeType: "text/markdown", text: section };
    }
    return {
      uri,
      mimeType: "text/markdown",
      text: `Category "${category}" not found in standards. Available categories can be seen in review://standards.`,
    };
  }

  throw new Error(`Unknown resource URI: ${uri}`);
}
