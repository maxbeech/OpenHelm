import type { IpcEvent } from "@openorchestra/shared";

/** Write a JSON message to stdout (IPC channel) */
export function send(msg: object) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

/** Emit an IPC event to the frontend */
export function emit(event: string, data: unknown = {}) {
  const evt: IpcEvent = { event, data };
  send(evt);
}
