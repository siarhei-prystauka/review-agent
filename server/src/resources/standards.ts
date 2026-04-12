import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

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
    console.error(`[standards] Loaded coding standards from ${STANDARDS_PATH}`);
  }
  return standardsCache!;
}

function extractCategory(
  standards: string,
  category: string
): string | null {
  const escaped = category.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    `^## ${escaped}\\b[^\\n]*\\n([\\s\\S]*?)(?=^## |$)`,
    "mi"
  );
  const match = standards.match(regex);
  return match ? match[0].trim() : null;
}

export function registerStandardsResources(server: McpServer): void {
  server.registerResource(
    "Coding Standards",
    "review://standards",
    {
      description:
        "Complete coding standards and review guidelines used by the review agents.",
      mimeType: "text/markdown",
    },
    async (uri) => {
      const standards = await loadStandards();
      return {
        contents: [{ uri: uri.toString(), mimeType: "text/markdown", text: standards }],
      };
    }
  );

  const categoryTemplate = new ResourceTemplate(
    "review://standards/{category}",
    { list: undefined }
  );

  server.registerResource(
    "Coding Standards by Category",
    categoryTemplate,
    {
      description:
        "Specific category of coding standards (e.g., naming, security, error-handling, testing, complexity, documentation).",
      mimeType: "text/markdown",
    },
    async (uri, variables) => {
      const standards = await loadStandards();
      const rawCategory = Array.isArray(variables.category)
        ? variables.category[0]
        : variables.category;
      const category = rawCategory
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c: string) => c.toUpperCase());
      const section = extractCategory(standards, category);
      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: "text/markdown",
            text:
              section ??
              `Category "${category}" not found in standards. Available categories can be seen in review://standards.`,
          },
        ],
      };
    }
  );
}
