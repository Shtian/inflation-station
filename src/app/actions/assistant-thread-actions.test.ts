import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteAssistantThreadAction } from "./delete-assistant-thread";
import { renameAssistantThreadAction } from "./rename-assistant-thread";

const { renameMock, deleteMock } = vi.hoisted(() => ({
  renameMock: vi.fn(),
  deleteMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { _tag: "prisma-mock" } }));

vi.mock("@/lib/assistant/threads", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/assistant/threads")>()),
  renameAssistantThread: renameMock,
  deleteAssistantThread: deleteMock,
}));

beforeEach(() => {
  renameMock.mockReset().mockResolvedValue(undefined);
  deleteMock.mockReset().mockResolvedValue(undefined);
});

describe("renameAssistantThreadAction", () => {
  it("stores the trimmed title", async () => {
    const result = await renameAssistantThreadAction({
      id: "thread-1",
      title: "  Forbruk i høst  ",
    });

    expect(result).toEqual({
      ok: true,
      data: { id: "thread-1", title: "Forbruk i høst" },
    });
    expect(renameMock.mock.calls[0].slice(1)).toEqual([
      "thread-1",
      "Forbruk i høst",
    ]);
  });

  it.each([
    ["blank", "   "],
    ["longer than 80 characters", "a".repeat(81)],
  ])("rejects a %s title without saving", async (_label, title) => {
    const result = await renameAssistantThreadAction({ id: "thread-1", title });

    expect(result.ok ? null : result.error.code).toBe(
      "INVALID_ASSISTANT_THREAD_RENAME_PAYLOAD",
    );
    expect(renameMock).not.toHaveBeenCalled();
  });

  it("reports a thread that no longer exists", async () => {
    renameMock.mockRejectedValue({ code: "P2025" });

    const result = await renameAssistantThreadAction({
      id: "thread-1",
      title: "Navn",
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "ASSISTANT_THREAD_NOT_FOUND",
        message: "Fant ikke samtalen.",
      },
    });
  });
});

describe("deleteAssistantThreadAction", () => {
  it("deletes the thread", async () => {
    const result = await deleteAssistantThreadAction({ id: "thread-1" });

    expect(result).toEqual({ ok: true, data: { id: "thread-1" } });
    expect(deleteMock.mock.calls[0].slice(1)).toEqual(["thread-1"]);
  });

  it("rejects an unsafe id without deleting", async () => {
    const result = await deleteAssistantThreadAction({ id: "../thread" });

    expect(result.ok ? null : result.error.code).toBe(
      "INVALID_ASSISTANT_THREAD_DELETE_PAYLOAD",
    );
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("reports a thread that no longer exists", async () => {
    deleteMock.mockRejectedValue({ code: "P2025" });

    const result = await deleteAssistantThreadAction({ id: "thread-1" });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "ASSISTANT_THREAD_NOT_FOUND",
        message: "Fant ikke samtalen.",
      },
    });
  });
});
