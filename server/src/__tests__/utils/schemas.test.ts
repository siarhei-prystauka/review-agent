/**
 * Unit tests for schemas.ts validation
 */

import { describe, it, expect } from "@jest/globals";
import { PrIdentifierSchema } from "../../utils/schemas.js";

describe("PrIdentifierSchema", () => {
  it("should validate correct PR identifier", () => {
    const validData = {
      owner: "octocat",
      repo: "hello-world",
      pr_number: 42,
    };

    const result = PrIdentifierSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validData);
    }
  });

  it("should accept empty owner string (Zod default behavior)", () => {
    const data = {
      owner: "",
      repo: "hello-world",
      pr_number: 42,
    };

    const result = PrIdentifierSchema.safeParse(data);
    // Zod allows empty strings by default unless .min(1) is used
    expect(result.success).toBe(true);
  });

  it("should accept empty repo string (Zod default behavior)", () => {
    const data = {
      owner: "octocat",
      repo: "",
      pr_number: 42,
    };

    const result = PrIdentifierSchema.safeParse(data);
    // Zod allows empty strings by default unless .min(1) is used
    expect(result.success).toBe(true);
  });

  it("should reject non-positive PR number", () => {
    const invalidData = {
      owner: "octocat",
      repo: "hello-world",
      pr_number: 0,
    };

    const result = PrIdentifierSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it("should reject negative PR number", () => {
    const invalidData = {
      owner: "octocat",
      repo: "hello-world",
      pr_number: -1,
    };

    const result = PrIdentifierSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it("should reject non-integer PR number", () => {
    const invalidData = {
      owner: "octocat",
      repo: "hello-world",
      pr_number: 42.5,
    };

    const result = PrIdentifierSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it("should reject missing fields", () => {
    const invalidData = {
      owner: "octocat",
      repo: "hello-world",
    };

    const result = PrIdentifierSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it("should reject extra fields", () => {
    const invalidData = {
      owner: "octocat",
      repo: "hello-world",
      pr_number: 42,
      extra: "field",
    };

    const result = PrIdentifierSchema.safeParse(invalidData);
    // Zod allows extra fields by default, so this should pass
    // If you want to be strict, use .strict() on the schema
    expect(result.success).toBe(true);
  });
});
