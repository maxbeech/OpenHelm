import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { send, emit } from "../src/ipc/emitter.js";

// Mock the dev-server broadcastEvent
vi.mock("../src/ipc/dev-server.js", () => ({
  broadcastEvent: vi.fn(),
}));

describe("IPC emitter", () => {
  let stdoutWriteSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutWriteSpy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
  });

  afterEach(() => {
    stdoutWriteSpy.mockRestore();
  });

  it("writes JSON + newline to stdout", () => {
    send({ hello: "world" });
    expect(stdoutWriteSpy).toHaveBeenCalledWith('{"hello":"world"}\n');
  });

  it("does not throw when stdout.write throws (broken pipe)", () => {
    stdoutWriteSpy.mockImplementation(() => {
      throw new Error("write EPIPE");
    });

    // Must not throw — a broken pipe should be silently caught
    expect(() => send({ test: true })).not.toThrow();
  });

  it("still broadcasts to SSE clients when stdout fails", async () => {
    const { broadcastEvent } = await import("../src/ipc/dev-server.js");
    stdoutWriteSpy.mockImplementation(() => {
      throw new Error("write EPIPE");
    });

    send({ test: true });
    expect(broadcastEvent).toHaveBeenCalledWith('{"test":true}');
  });

  it("emit wraps data as IpcEvent", () => {
    emit("test.event", { key: "value" });
    expect(stdoutWriteSpy).toHaveBeenCalledWith(
      JSON.stringify({ event: "test.event", data: { key: "value" } }) + "\n",
    );
  });
});
