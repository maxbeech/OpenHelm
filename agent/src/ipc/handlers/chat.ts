import { registerHandler } from "../handler.js";
import {
  handleChatMessage,
  handleActionApproval,
  handleActionRejection,
  handleApproveAll,
  handleRejectAll,
} from "../../chat/handler.js";
import { listMessagesForProject, clearConversation } from "../../db/queries/conversations.js";
import { emit } from "../emitter.js";
import type {
  SendChatMessageParams,
  ApproveChatActionParams,
  RejectChatActionParams,
  ApproveAllChatActionsParams,
  RejectAllChatActionsParams,
  ListChatMessagesParams,
  ClearChatParams,
} from "@openhelm/shared";

/** Normalise projectId: treat undefined and empty string as null ("All Projects"). */
function normaliseProjectId(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  return String(raw);
}

export function registerChatHandlers() {
  // chat.send returns immediately — messages and errors arrive via events.
  // This prevents frontend IPC timeouts on long-running LLM tool loops.
  //
  // IMPORTANT: handleChatMessage is deferred via setImmediate so its synchronous
  // preamble (DB reads/writes via better-sqlite3) runs AFTER send(response) has
  // already been written to stdout. Without this deferral, a SQLite busy-wait in
  // the sync preamble would block the Node.js main thread before the IPC response
  // is sent, causing the frontend to time out after REQUEST_TIMEOUT_MS (4 min).
  registerHandler("chat.send", (params) => {
    const p = params as SendChatMessageParams;
    const projectId = normaliseProjectId(p?.projectId);
    if (!p?.content?.trim()) throw new Error("content is required");

    setImmediate(() => {
      handleChatMessage(projectId, p.content.trim(), p.context, p.model, p.modelEffort, p.permissionMode)
        .catch((err) => {
          console.error("[chat] send failed:", err);
          emit("chat.error", {
            projectId,
            error: err instanceof Error ? err.message : String(err),
          });
          emit("chat.status", { status: "done", projectId });
        });
    });

    return { started: true };
  });

  registerHandler("chat.approveAction", async (params) => {
    const p = params as ApproveChatActionParams;
    if (!p?.messageId) throw new Error("messageId is required");
    if (!p?.callId) throw new Error("callId is required");
    if (!p?.projectId) throw new Error("projectId is required");
    return handleActionApproval(p.messageId, p.callId, p.projectId);
  });

  registerHandler("chat.rejectAction", (params) => {
    const p = params as RejectChatActionParams;
    if (!p?.messageId) throw new Error("messageId is required");
    if (!p?.callId) throw new Error("callId is required");
    return handleActionRejection(p.messageId, p.callId);
  });

  registerHandler("chat.approveAll", async (params) => {
    const p = params as ApproveAllChatActionsParams;
    if (!p?.messageId) throw new Error("messageId is required");
    if (!p?.projectId) throw new Error("projectId is required");
    return handleApproveAll(p.messageId, p.projectId);
  });

  registerHandler("chat.rejectAll", (params) => {
    const p = params as RejectAllChatActionsParams;
    if (!p?.messageId) throw new Error("messageId is required");
    return handleRejectAll(p.messageId);
  });

  registerHandler("chat.listMessages", (params) => {
    const p = params as ListChatMessagesParams;
    const projectId = normaliseProjectId(p?.projectId);
    return listMessagesForProject(projectId, p?.limit, p?.beforeId);
  });

  registerHandler("chat.clear", (params) => {
    const p = params as ClearChatParams;
    const projectId = normaliseProjectId(p?.projectId);
    clearConversation(projectId);
    return { cleared: true };
  });
}
