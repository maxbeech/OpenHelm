import { describe, it, expect } from "vitest";
import { validateCronExpression } from "../src/planner/cron-validator.js";

describe("validateCronExpression", () => {
  it("should accept a valid cron expression (every Monday at 9am)", () => {
    expect(() => validateCronExpression("0 9 * * 1")).not.toThrow();
  });

  it("should accept every-5-minutes cron", () => {
    expect(() => validateCronExpression("*/5 * * * *")).not.toThrow();
  });

  it("should accept daily at midnight", () => {
    expect(() => validateCronExpression("0 0 * * *")).not.toThrow();
  });

  it("should throw on an invalid cron expression", () => {
    expect(() => validateCronExpression("bad cron")).toThrow();
  });

  it("should throw on a partial expression (only 2 fields)", () => {
    expect(() => validateCronExpression("0 9")).toThrow();
  });
});
