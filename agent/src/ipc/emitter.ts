import type { IpcEvent } from "@openorchestra/shared";
import { broadcastEvent } from "./dev-server.js";

/** Write a JSON message to stdout (IPC channel) and SSE clients */
export function send(msg: object) {
  const line = JSON.stringify(msg);
  process.stdout.write(line + "\n");
  broadcastEvent(line);
}

/** Emit an IPC event to the frontend */
export function emit(event: string, data: unknown = {}) {
  const evt: IpcEvent = { event, data };
  send(evt);
}
