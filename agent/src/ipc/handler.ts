import type { IpcRequest, IpcResponse, IpcError } from "@openorchestra/shared";

type HandlerFn = (params?: unknown) => unknown | Promise<unknown>;

const handlers = new Map<string, HandlerFn>();

/** Register an IPC method handler */
export function registerHandler(method: string, fn: HandlerFn) {
  handlers.set(method, fn);
}

/** Route an IPC request to the appropriate handler */
export async function handleRequest(req: IpcRequest): Promise<IpcResponse> {
  const handler = handlers.get(req.method);

  if (!handler) {
    const error: IpcError = {
      code: -32601,
      message: `Unknown method: ${req.method}`,
    };
    return { id: req.id, error };
  }

  try {
    const result = await handler(req.params);
    return { id: req.id, result };
  } catch (err) {
    const error: IpcError = {
      code: -32603,
      message: err instanceof Error ? err.message : String(err),
    };
    return { id: req.id, error };
  }
}

// -- Built-in handlers --

const startTime = Date.now();

registerHandler("ping", () => ({
  message: "pong",
  timestamp: Date.now(),
}));

registerHandler("health", () => ({
  uptime: Math.floor((Date.now() - startTime) / 1000),
  memory: process.memoryUsage(),
}));
