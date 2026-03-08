/** IPC request sent from UI to agent via stdin */
export interface IpcRequest {
  id: string;
  method: string;
  params?: unknown;
}

/** Structured error returned by the agent */
export interface IpcError {
  code: number;
  message: string;
}

/** IPC response sent from agent to UI via stdout */
export interface IpcResponse {
  id: string;
  result?: unknown;
  error?: IpcError;
}

/** Unprompted event emitted by the agent */
export interface IpcEvent {
  event: string;
  data: unknown;
}

/** Type guard: checks if a parsed JSON object is an IpcResponse */
export function isIpcResponse(obj: unknown): obj is IpcResponse {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "id" in obj &&
    typeof (obj as IpcResponse).id === "string"
  );
}

/** Type guard: checks if a parsed JSON object is an IpcEvent */
export function isIpcEvent(obj: unknown): obj is IpcEvent {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "event" in obj &&
    typeof (obj as IpcEvent).event === "string" &&
    !("id" in obj)
  );
}
