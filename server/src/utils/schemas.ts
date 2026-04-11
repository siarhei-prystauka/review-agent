import { z } from "zod";

export const PrIdentifierSchema = z.object({
  owner: z.string().describe("Repository owner (e.g., 'octocat')"),
  repo: z.string().describe("Repository name (e.g., 'hello-world')"),
  pr_number: z.number().int().positive().describe("Pull request number"),
});
