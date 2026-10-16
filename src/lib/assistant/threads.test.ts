import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createTestDatabase,
  type TestDatabase,
  teardownTestDatabase,
} from "../../../tests/support/prisma-test-db";
import type { AssistantUIMessage } from "./contract";
import {
  assistantThreadIdSchema,
  deleteAssistantThread,
  getAssistantThread,
  listAssistantThreads,
  renameAssistantThread,
  saveAssistantThreadMessages,
} from "./threads";

function userMessage(id: string, text: string): AssistantUIMessage {
  return { id, role: "user", parts: [{ type: "text", text }] };
}

function assistantMessage(id: string, text: string): AssistantUIMessage {
  return { id, role: "assistant", parts: [{ type: "text", text }] };
}

function tick() {
  return new Promise((resolve) => setTimeout(resolve, 5));
}

describe("assistant threads", () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await createTestDatabase();
  });

  beforeEach(async () => {
    await db.client.assistantThread.deleteMany();
  });

  afterAll(async () => {
    await teardownTestDatabase(db);
  });

  it("titles a new thread after its first question, whitespace collapsed", async () => {
    await saveAssistantThreadMessages(db.client, "t1", [
      userMessage("u1", "  Hvor mye brukte jeg\n på   dagligvarer?  "),
    ]);

    expect(await getAssistantThread(db.client, "t1")).toEqual({
      id: "t1",
      title: "Hvor mye brukte jeg på dagligvarer?",
      messages: [
        userMessage("u1", "  Hvor mye brukte jeg\n på   dagligvarer?  "),
      ],
    });
  });

  it("truncates a long first question to 60 characters", async () => {
    await saveAssistantThreadMessages(db.client, "t1", [
      userMessage(
        "u1",
        "Kan du sammenligne forbruket mitt på restaurant og kafé i september med august og juli?",
      ),
    ]);

    const thread = await getAssistantThread(db.client, "t1");
    expect(thread?.title).toBe(
      "Kan du sammenligne forbruket mitt på restaurant og kafé i s…",
    );
  });

  it("falls back to Ny samtale when there is no question text", async () => {
    await saveAssistantThreadMessages(db.client, "t1", [
      userMessage("u1", "   "),
    ]);

    expect((await getAssistantThread(db.client, "t1"))?.title).toBe(
      "Ny samtale",
    );
  });

  it("keeps a renamed title when later turns are saved", async () => {
    await saveAssistantThreadMessages(db.client, "t1", [
      userMessage("u1", "Hva brukte jeg mest på?"),
    ]);
    await renameAssistantThread(db.client, "t1", "Forbruk i høst");
    await saveAssistantThreadMessages(db.client, "t1", [
      userMessage("u1", "Hva brukte jeg mest på?"),
      assistantMessage("a1", "Dagligvarer."),
    ]);

    expect(await getAssistantThread(db.client, "t1")).toEqual({
      id: "t1",
      title: "Forbruk i høst",
      messages: [
        userMessage("u1", "Hva brukte jeg mest på?"),
        assistantMessage("a1", "Dagligvarer."),
      ],
    });
  });

  it("converges to one row when the same save runs twice", async () => {
    const messages = [userMessage("u1", "Hei")];
    await saveAssistantThreadMessages(db.client, "t1", messages);
    await saveAssistantThreadMessages(db.client, "t1", messages);

    expect(
      (await listAssistantThreads(db.client)).map(({ id, title }) => ({
        id,
        title,
      })),
    ).toEqual([{ id: "t1", title: "Hei" }]);
  });

  it("lists the most recently saved thread first", async () => {
    await saveAssistantThreadMessages(db.client, "older", [
      userMessage("u1", "Første"),
    ]);
    await tick();
    await saveAssistantThreadMessages(db.client, "newer", [
      userMessage("u2", "Andre"),
    ]);
    await tick();
    await saveAssistantThreadMessages(db.client, "older", [
      userMessage("u1", "Første"),
      assistantMessage("a1", "Svar"),
    ]);

    expect(
      (await listAssistantThreads(db.client)).map((thread) => thread.title),
    ).toEqual(["Første", "Andre"]);
  });

  it("keeps a thread's place in the list when it is renamed", async () => {
    await saveAssistantThreadMessages(db.client, "older", [
      userMessage("u1", "Første"),
    ]);
    await tick();
    await saveAssistantThreadMessages(db.client, "newer", [
      userMessage("u2", "Andre"),
    ]);
    await tick();
    await renameAssistantThread(db.client, "older", "Omdøpt");

    expect(
      (await listAssistantThreads(db.client)).map((thread) => thread.title),
    ).toEqual(["Andre", "Omdøpt"]);
  });

  it("deletes a thread so it is neither listed nor readable", async () => {
    await saveAssistantThreadMessages(db.client, "keep", [
      userMessage("u1", "Behold"),
    ]);
    await saveAssistantThreadMessages(db.client, "drop", [
      userMessage("u2", "Slett"),
    ]);

    await deleteAssistantThread(db.client, "drop");

    expect(await getAssistantThread(db.client, "drop")).toBeNull();
    expect(
      (await listAssistantThreads(db.client)).map((thread) => thread.id),
    ).toEqual(["keep"]);
  });

  it("rejects renaming or deleting a thread that does not exist", async () => {
    await expect(
      renameAssistantThread(db.client, "missing", "Navn"),
    ).rejects.toMatchObject({ code: "P2025" });
    await expect(
      deleteAssistantThread(db.client, "missing"),
    ).rejects.toMatchObject({ code: "P2025" });
  });
});

describe("assistantThreadIdSchema", () => {
  it.each([
    ["aZ09_-", true],
    ["", false],
    ["a".repeat(65), false],
    ["../etc", false],
    ["id med mellomrom", false],
  ])("accepts %j: %s", (id, accepted) => {
    expect(assistantThreadIdSchema.safeParse(id).success).toBe(accepted);
  });
});
