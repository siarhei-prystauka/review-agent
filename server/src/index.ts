import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { registerPrTools } from "./tools/pr-tools.js";
import { registerReviewTools } from "./tools/review-tools.js";
import { registerStandardsResources } from "./resources/standards.js";
import { registerReviewPrompts } from "./prompts/review-prompts.js";

const server = new McpServer({
  name: "review-agent",
  version: "0.1.0",
});

registerPrTools(server);
registerReviewTools(server);
registerStandardsResources(server);
registerReviewPrompts(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Server failed to start:", error);
  process.exit(1);
});
