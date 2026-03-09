import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestDb } from "./helpers.js";
import { registerHandler, handleRequest } from "../src/ipc/handler.js";
import { PrintError } from "../src/claude-code/print.js";

let cleanup: () => void;

beforeAll(() => {
  cleanup = setupTestDb();

  // Register test handlers that throw specific error types
  registerHandler("test.throwPrintError", () => {
    throw new PrintError("Claude Code exited with code 1", 1);
  });

  registerHandler("test.throwPrintTimeout", () => {
    throw new PrintError("Claude Code timed out after 60000ms", null);
  });

  registerHandler("test.throwGenericError", () => {
    throw new Error("Something broke");
  });

  registerHandler("test.throwString", () => {
    throw "raw string error"; // eslint-disable-line no-throw-literal
  });

  registerHandler("test.success", () => ({ ok: true }));
});

afterAll(() => cleanup());

describe("IPC handler — PrintError mapping", () => {
  it("maps PrintError to code -32001 with its message", async () => {
    const res = await handleRequest({
      id: "1",
      method: "test.throwPrintError",
    });
    expect(res.error).toBeDefined();
    expect(res.error!.code).toBe(-32001);
    expect(res.error!.message).toContain("exited with code 1");
  });

  it("maps PrintError timeout to code -32001", async () => {
    const res = await handleRequest({
      id: "2",
      method: "test.throwPrintTimeout",
    });
    expect(res.error).toBeDefined();
    expect(res.error!.code).toBe(-32001);
    expect(res.error!.message).toContain("timed out");
  });
});

describe("IPC handler — generic errors", () => {
  it("maps a regular Error to code -32603", async () => {
    const res = await handleRequest({
      id: "3",
      method: "test.throwGenericError",
    });
    expect(res.error).toBeDefined();
    expect(res.error!.code).toBe(-32603);
    expect(res.error!.message).toBe("Something broke");
  });

  it("maps a thrown string to code -32603", async () => {
    const res = await handleRequest({
      id: "4",
      method: "test.throwString",
    });
    expect(res.error).toBeDefined();
    expect(res.error!.code).toBe(-32603);
    expect(res.error!.message).toBe("raw string error");
  });
});

describe("IPC handler — unknown method", () => {
  it("returns code -32601 for unknown methods", async () => {
    const res = await handleRequest({
      id: "5",
      method: "nonexistent.method",
    });
    expect(res.error).toBeDefined();
    expect(res.error!.code).toBe(-32601);
    expect(res.error!.message).toContain("Unknown method");
  });
});

describe("IPC handler — success path", () => {
  it("returns result with no error on success", async () => {
    const res = await handleRequest({ id: "6", method: "test.success" });
    expect(res.error).toBeUndefined();
    expect(res.result).toEqual({ ok: true });
    expect(res.id).toBe("6");
  });
});
