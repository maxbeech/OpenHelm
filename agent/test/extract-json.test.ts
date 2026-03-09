import { describe, it, expect } from "vitest";
import { extractJson } from "../src/planner/extract-json.js";

describe("extractJson", () => {
  it("should return pure JSON unchanged", () => {
    const json = '{"needsClarification": false}';
    expect(extractJson(json)).toBe(json);
  });

  it("should extract JSON from markdown code fence", () => {
    const text = 'Here is the result:\n```json\n{"answer": true}\n```\nDone.';
    expect(JSON.parse(extractJson(text))).toEqual({ answer: true });
  });

  it("should extract JSON object from surrounding prose", () => {
    const text = 'Based on my analysis:\n{"needsClarification": false, "questions": []}\nHope that helps!';
    expect(JSON.parse(extractJson(text))).toEqual({
      needsClarification: false,
      questions: [],
    });
  });

  it("should handle nested braces correctly", () => {
    const text = 'Result: {"a": {"b": 1}, "c": "test"}';
    expect(JSON.parse(extractJson(text))).toEqual({ a: { b: 1 }, c: "test" });
  });

  it("should handle braces inside strings", () => {
    const text = 'Here: {"msg": "use { and } carefully"}';
    expect(JSON.parse(extractJson(text))).toEqual({ msg: "use { and } carefully" });
  });

  it("should return original text when no JSON found", () => {
    const text = "no json here";
    expect(extractJson(text)).toBe(text);
  });
});
