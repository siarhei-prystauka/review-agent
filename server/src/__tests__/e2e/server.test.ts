/**
 * End-to-end test for the MCP server
 * Tests basic server initialization
 */

import { describe, it, expect } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPrTools } from "../../tools/pr-tools.js";
import { registerReviewTools } from "../../tools/review-tools.js";

describe("End-to-End MCP Server Tests", () => {
  it("should initialize server with correct configuration", () => {
    const server = new McpServer({
      name: "review-agent",
      version: "0.1.0",
    });

    expect(server).toBeDefined();
  });

  it("should register PR tools without errors", () => {
    const server = new McpServer({
      name: "review-agent",
      version: "0.1.0",
    });

    expect(() => registerPrTools(server)).not.toThrow();
  });

  it("should register review tools without errors", () => {
    const server = new McpServer({
      name: "review-agent",
      version: "0.1.0",
    });

    expect(() => registerReviewTools(server)).not.toThrow();
  });

  it("should register all tools successfully", () => {
    const server = new McpServer({
      name: "review-agent",
      version: "0.1.0",
    });

    expect(() => {
      registerPrTools(server);
      registerReviewTools(server);
    }).not.toThrow();
  });
});
