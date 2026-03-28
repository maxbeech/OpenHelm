/**
 * Tests for the agent-client reconnection logic.
 *
 * These tests validate that when the sidecar dies and restarts:
 * 1. The ready promise is reset so new requests block until reconnected
 * 2. markReady() resolves the new promise on reconnection
 * 3. Pending requests are rejected on death
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Minimal in-memory AgentClient simulator (avoids Tauri/browser dependencies)
// Tests the reconnection state machine in isolation.

class TestableAgentClient {
  private ready = false;
  private connected = false;
  private readyResolve: (() => void) | null = null;
  readyPromise: Promise<void>;
  pending = new Map<string, { reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();

  constructor() {
    this.readyPromise = new Promise((resolve) => {
      this.readyResolve = resolve;
    });
  }

  markReady() {
    if (this.ready) return;
    this.ready = true;
    this.connected = true;
    if (this.readyResolve) {
      this.readyResolve();
      this.readyResolve = null;
    }
  }

  handleSidecarDeath() {
    this.connected = false;
    this.ready = false;
    this.readyPromise = new Promise((resolve) => {
      this.readyResolve = resolve;
    });
    for (const [id, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(new Error("Agent process terminated unexpectedly"));
      this.pending.delete(id);
    }
  }

  isReady() { return this.ready; }
  isConnected() { return this.connected; }
}

describe("AgentClient reconnection", () => {
  let client: TestableAgentClient;

  beforeEach(() => {
    client = new TestableAgentClient();
  });

  it("starts not ready", () => {
    expect(client.isReady()).toBe(false);
    expect(client.isConnected()).toBe(false);
  });

  it("becomes ready on markReady", async () => {
    client.markReady();
    await client.readyPromise; // should resolve immediately
    expect(client.isReady()).toBe(true);
    expect(client.isConnected()).toBe(true);
  });

  it("resets ready state on sidecar death", async () => {
    client.markReady();
    await client.readyPromise;
    expect(client.isReady()).toBe(true);

    client.handleSidecarDeath();
    expect(client.isReady()).toBe(false);
    expect(client.isConnected()).toBe(false);
  });

  it("new readyPromise blocks after sidecar death", async () => {
    client.markReady();
    await client.readyPromise;

    client.handleSidecarDeath();

    // New readyPromise should be pending (not resolved)
    let resolved = false;
    client.readyPromise.then(() => { resolved = true; });
    // Give microtasks a chance to run
    await new Promise((r) => setTimeout(r, 10));
    expect(resolved).toBe(false);
  });

  it("markReady resolves new readyPromise after restart", async () => {
    client.markReady();
    await client.readyPromise;

    client.handleSidecarDeath();

    let resolved = false;
    client.readyPromise.then(() => { resolved = true; });
    await new Promise((r) => setTimeout(r, 10));
    expect(resolved).toBe(false);

    // Simulate sidecar restart sending agent.ready
    client.markReady();
    await client.readyPromise;
    expect(resolved).toBe(true);
    expect(client.isReady()).toBe(true);
    expect(client.isConnected()).toBe(true);
  });

  it("rejects pending requests on death", async () => {
    client.markReady();

    const rejectSpy = vi.fn();
    client.pending.set("req-1", {
      reject: rejectSpy,
      timer: setTimeout(() => {}, 60000),
    });

    client.handleSidecarDeath();

    expect(rejectSpy).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Agent process terminated unexpectedly" }),
    );
    expect(client.pending.size).toBe(0);
  });

  it("handles multiple death/restart cycles", async () => {
    for (let i = 0; i < 3; i++) {
      client.markReady();
      await client.readyPromise;
      expect(client.isReady()).toBe(true);

      client.handleSidecarDeath();
      expect(client.isReady()).toBe(false);
    }

    // Final reconnect
    client.markReady();
    await client.readyPromise;
    expect(client.isReady()).toBe(true);
  });
});
