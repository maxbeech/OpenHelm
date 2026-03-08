import { describe, it, expect } from "vitest";
import { executeTool, PLANNING_TOOLS } from "../src/llm/tools.js";

describe("PLANNING_TOOLS", () => {
  it("should define validate_cron_expression tool", () => {
    const tool = PLANNING_TOOLS.find((t) => t.name === "validate_cron_expression");
    expect(tool).toBeDefined();
    expect(tool!.input_schema.type).toBe("object");
    expect(tool!.input_schema.required).toContain("expression");
  });

  it("should define get_current_datetime tool", () => {
    const tool = PLANNING_TOOLS.find((t) => t.name === "get_current_datetime");
    expect(tool).toBeDefined();
    expect(tool!.input_schema.type).toBe("object");
  });
});

describe("executeTool", () => {
  describe("validate_cron_expression", () => {
    it("should validate a correct cron expression", () => {
      const result = JSON.parse(
        executeTool("validate_cron_expression", { expression: "0 9 * * 1" }),
      );
      expect(result.valid).toBe(true);
      expect(result.expression).toBe("0 9 * * 1");
      expect(result.nextOccurrences).toHaveLength(3);
    });

    it("should return every-5-minutes cron occurrences", () => {
      const result = JSON.parse(
        executeTool("validate_cron_expression", { expression: "*/5 * * * *" }),
      );
      expect(result.valid).toBe(true);
      expect(result.nextOccurrences).toHaveLength(3);
    });

    it("should reject an invalid cron expression", () => {
      const result = JSON.parse(
        executeTool("validate_cron_expression", { expression: "bad cron" }),
      );
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should reject an empty expression", () => {
      const result = JSON.parse(
        executeTool("validate_cron_expression", { expression: "" }),
      );
      expect(result.valid).toBe(false);
    });
  });

  describe("get_current_datetime", () => {
    it("should return current datetime info", () => {
      const result = JSON.parse(executeTool("get_current_datetime", {}));
      expect(result.iso).toBeDefined();
      expect(result.local).toBeDefined();
      expect(result.timezone).toBeDefined();
      expect(result.dayOfWeek).toBeDefined();

      // Verify ISO string is valid
      const date = new Date(result.iso);
      expect(date.getTime()).not.toBeNaN();

      // Should be approximately now
      const diff = Math.abs(Date.now() - date.getTime());
      expect(diff).toBeLessThan(5000);
    });
  });

  describe("unknown tool", () => {
    it("should return an error for unknown tools", () => {
      const result = JSON.parse(executeTool("nonexistent_tool", {}));
      expect(result.error).toContain("Unknown tool");
    });
  });
});
