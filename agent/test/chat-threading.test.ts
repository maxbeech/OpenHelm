import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestDb } from "./helpers.js";
import { createProject } from "../src/db/queries/projects.js";
import {
  getOrCreateConversation,
  createMessage,
  listMessagesForProject,
  clearConversation,
  getProjectIdForMessage,
} from "../src/db/queries/conversations.js";

let cleanup: () => void;
let projectA: string;
let projectB: string;

beforeAll(() => {
  cleanup = setupTestDb();
  projectA = createProject({ name: "Project A", directoryPath: "/tmp/a" }).id;
  projectB = createProject({ name: "Project B", directoryPath: "/tmp/b" }).id;
});

afterAll(() => cleanup());

describe("per-project chat threading", () => {
  it("creates separate conversations for different projects", () => {
    const convA = getOrCreateConversation(projectA);
    const convB = getOrCreateConversation(projectB);

    expect(convA.id).not.toBe(convB.id);
    expect(convA.projectId).toBe(projectA);
    expect(convB.projectId).toBe(projectB);
  });

  it("returns the same conversation on repeated calls for the same project", () => {
    const first = getOrCreateConversation(projectA);
    const second = getOrCreateConversation(projectA);
    expect(first.id).toBe(second.id);
  });

  it("isolates messages between projects", () => {
    const convA = getOrCreateConversation(projectA);
    const convB = getOrCreateConversation(projectB);

    createMessage({ conversationId: convA.id, role: "user", content: "hello from A" });
    createMessage({ conversationId: convB.id, role: "user", content: "hello from B" });
    createMessage({ conversationId: convA.id, role: "assistant", content: "reply to A" });

    const msgsA = listMessagesForProject(projectA);
    const msgsB = listMessagesForProject(projectB);

    expect(msgsA).toHaveLength(2);
    const contentsA = msgsA.map((m) => m.content);
    expect(contentsA).toContain("hello from A");
    expect(contentsA).toContain("reply to A");

    expect(msgsB).toHaveLength(1);
    expect(msgsB[0].content).toBe("hello from B");
  });

  it("clearConversation only clears the target project", () => {
    clearConversation(projectA);

    expect(listMessagesForProject(projectA)).toHaveLength(0);
    expect(listMessagesForProject(projectB)).toHaveLength(1);
  });
});

describe("All Projects thread (null projectId)", () => {
  it("creates a conversation with null projectId", () => {
    const conv = getOrCreateConversation(null);

    expect(conv.projectId).toBeNull();
    expect(conv.channel).toBe("app");
  });

  it("returns the same conversation on repeated calls for null", () => {
    const first = getOrCreateConversation(null);
    const second = getOrCreateConversation(null);
    expect(first.id).toBe(second.id);
  });

  it("separates null thread from project-specific threads", () => {
    const convAll = getOrCreateConversation(null);
    const convA = getOrCreateConversation(projectA);

    expect(convAll.id).not.toBe(convA.id);
  });

  it("stores and retrieves messages in the null thread", () => {
    const conv = getOrCreateConversation(null);
    createMessage({ conversationId: conv.id, role: "user", content: "cross-project question" });
    createMessage({ conversationId: conv.id, role: "assistant", content: "here's the answer" });

    const msgs = listMessagesForProject(null);
    expect(msgs).toHaveLength(2);
    const contents = msgs.map((m) => m.content);
    expect(contents).toContain("cross-project question");
    expect(contents).toContain("here's the answer");
  });

  it("clearConversation(null) only clears the All Projects thread", () => {
    // Project B still has its message from earlier
    const countBefore = listMessagesForProject(projectB).length;
    expect(countBefore).toBeGreaterThan(0);

    clearConversation(null);

    expect(listMessagesForProject(null)).toHaveLength(0);
    expect(listMessagesForProject(projectB)).toHaveLength(countBefore);
  });

  it("getProjectIdForMessage returns null for All Projects messages", () => {
    const conv = getOrCreateConversation(null);
    const msg = createMessage({ conversationId: conv.id, role: "user", content: "test" });

    expect(getProjectIdForMessage(msg.id)).toBeNull();
  });

  it("getProjectIdForMessage returns the project ID for project messages", () => {
    const conv = getOrCreateConversation(projectB);
    const msg = createMessage({ conversationId: conv.id, role: "user", content: "test" });

    expect(getProjectIdForMessage(msg.id)).toBe(projectB);
  });
});
