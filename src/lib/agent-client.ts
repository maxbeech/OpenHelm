import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  IpcRequest,
  IpcResponse,
  IpcEvent,
} from "@openorchestra/shared";
import { isIpcResponse, isIpcEvent } from "@openorchestra/shared";

const REQUEST_TIMEOUT_MS = 30_000;

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

class AgentClient {
  private pending = new Map<string, PendingRequest>();
  private ready = false;
  private readyResolve: (() => void) | null = null;
  private readyPromise: Promise<void>;
  private connected = false;
  private unlisten: (() => void) | null = null;

  constructor() {
    this.readyPromise = new Promise((resolve) => {
      this.readyResolve = resolve;
    });
  }

  /** Start listening for sidecar stdout events */
  async start() {
    if (this.unlisten) return;

    this.unlisten = await listen<string>("sidecar-stdout", (event) => {
      this.handleLine(event.payload);
    });

    this.connected = true;

    // The agent.ready event likely fired before this listener was set up
    // (sidecar starts in Rust setup(), before WebView loads).
    // Probe with a ping to confirm the agent is alive.
    this.probeReadiness();
  }

  /** Stop listening */
  stop() {
    if (this.unlisten) {
      this.unlisten();
      this.unlisten = null;
    }
    this.connected = false;
    this.ready = false;

    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error("Agent client stopped"));
      this.pending.delete(id);
    }
  }

  /** Send an IPC request and wait for the response */
  async request<T = unknown>(
    method: string,
    params?: unknown,
  ): Promise<T> {
    await this.readyPromise;
    return this.sendRaw<T>(method, params);
  }

  /** Whether the agent is connected and ready */
  isReady() {
    return this.ready;
  }

  isConnected() {
    return this.connected;
  }

  /** Send a request without waiting for readiness */
  private sendRaw<T = unknown>(
    method: string,
    params?: unknown,
  ): Promise<T> {
    const id = crypto.randomUUID();
    const req: IpcRequest = { id, method, params };

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Request "${method}" timed out after ${REQUEST_TIMEOUT_MS}ms`));
      }, REQUEST_TIMEOUT_MS);

      this.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timer,
      });

      invoke("write_to_sidecar", { message: JSON.stringify(req) }).catch(
        (err) => {
          clearTimeout(timer);
          this.pending.delete(id);
          reject(new Error(`Failed to write to sidecar: ${err}`));
        },
      );
    });
  }

  /** Probe the agent with a ping — if it responds, mark as ready */
  private async probeReadiness() {
    try {
      await this.sendRaw("ping");
      this.markReady();
    } catch {
      // Agent not responding yet; will be marked ready via agent.ready event
    }
  }

  private markReady() {
    if (this.ready) return;
    this.ready = true;
    if (this.readyResolve) {
      this.readyResolve();
      this.readyResolve = null;
    }
    window.dispatchEvent(new CustomEvent("agent:agent.ready"));
  }

  private handleLine(line: string) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      console.warn("[agent-client] non-JSON line from sidecar:", line);
      return;
    }

    if (isIpcResponse(parsed)) {
      const pending = this.pending.get(parsed.id);
      if (pending) {
        clearTimeout(pending.timer);
        this.pending.delete(parsed.id);

        if (parsed.error) {
          pending.reject(
            new Error(`[${parsed.error.code}] ${parsed.error.message}`),
          );
        } else {
          pending.resolve(parsed.result);
        }
      }
      return;
    }

    if (isIpcEvent(parsed)) {
      // Handle ready event
      if (parsed.event === "agent.ready") {
        this.markReady();
      }

      // Dispatch as CustomEvent on window
      window.dispatchEvent(
        new CustomEvent(`agent:${parsed.event}`, { detail: parsed.data }),
      );
      return;
    }

    console.warn("[agent-client] unknown message from sidecar:", parsed);
  }
}

/** Singleton agent client */
export const agentClient = new AgentClient();
