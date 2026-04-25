import { z } from "zod";

export const PrIdentifierSchema = z.object({
  owner: z.string().min(1).describe("Repository owner (e.g., 'octocat')"),
  repo: z.string().min(1).describe("Repository name (e.g., 'hello-world')"),
  pr_number: z.number().int().positive().describe("Pull request number"),
});
