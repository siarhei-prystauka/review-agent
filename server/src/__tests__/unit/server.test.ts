/**
 * Unit tests for the MCP server
 * Tests basic server initialization
 */

import { describe, it, expect } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPrTools } from "../../tools/pr-tools.js";
import { registerReviewTools } from "../../tools/review-tools.js";

function createTestServer(): McpServer {
  return new McpServer({
    name: "review-agent",
    version: "0.1.0",
  });
}

describe("MCP Server Unit Tests", () => {
  it("should initialize server with correct configuration", () => {
    const server = createTestServer();
    expect(server).toBeDefined();
  });

  it("should register PR tools without errors", () => {
    const server = createTestServer();
    expect(() => registerPrTools(server)).not.toThrow();
  });

  it("should register review tools without errors", () => {
    const server = createTestServer();
    expect(() => registerReviewTools(server)).not.toThrow();
  });

  it("should register all tools successfully", () => {
    const server = createTestServer();
    expect(() => {
      registerPrTools(server);
      registerReviewTools(server);
    }).not.toThrow();
  });
});
