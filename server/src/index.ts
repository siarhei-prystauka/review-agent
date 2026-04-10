import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { prTools } from "./tools/pr-tools.js";
import { reviewTools } from "./tools/review-tools.js";
import {
  standardsResources,
  standardsResourceTemplates,
  readStandardsResource,
} from "./resources/standards.js";
import { reviewPrompts, getPromptMessages } from "./prompts/review-prompts.js";

const allTools = [...prTools, ...reviewTools];

const server = new Server(
  {
    name: "review-agent",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
  }
);

// --- Tools ---

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: allTools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const tool = allTools.find((t) => t.name === request.params.name);
  if (!tool) {
    return {
      content: [
        { type: "text", text: `Unknown tool: ${request.params.name}` },
      ],
      isError: true,
    };
  }

  try {
    const result = await tool.handler(request.params.arguments);
    return {
      content: [
        { type: "text", text: JSON.stringify(result, null, 2) },
      ],
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
});

// --- Resources ---

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: standardsResources,
}));

server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
  resourceTemplates: standardsResourceTemplates,
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const resource = await readStandardsResource(request.params.uri);
  return {
    contents: [resource],
  };
});

// --- Prompts ---

server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: reviewPrompts,
}));

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const messages = getPromptMessages(
    request.params.name,
    (request.params.arguments ?? {}) as Record<string, string>
  );
  return { messages };
});

// --- Start ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Server failed to start:", error);
  process.exit(1);
});
