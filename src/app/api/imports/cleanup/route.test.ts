import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const { prismaMock, runCleanupChunkMock, getMessageCleanupSettingsMock } =
  vi.hoisted(() => ({
    prismaMock: {
      importReviewRow: { findMany: vi.fn() },
    },
    runCleanupChunkMock: vi.fn(),
    getMessageCleanupSettingsMock: vi.fn(),
  }));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

vi.mock("@/lib/import/message-cleanup/chunk", () => ({
  runCleanupChunk: runCleanupChunkMock,
}));

vi.mock("@/lib/import/message-cleanup-settings", () => ({
  getMessageCleanupSettings: getMessageCleanupSettingsMock,
}));

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/imports/cleanup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const STAGED_ROWS = [
  { id: "row-1", rowNumber: 2, name: "Joker", title: "Oslo" },
  { id: "row-2", rowNumber: 3, name: "Ruter", title: "" },
];

describe("POST /api/imports/cleanup", () => {
  beforeEach(() => {
    prismaMock.importReviewRow.findMany.mockReset();
    prismaMock.importReviewRow.findMany.mockResolvedValue(STAGED_ROWS);

    runCleanupChunkMock.mockReset();
    runCleanupChunkMock.mockResolvedValue({
      status: "ok",
      suggestions: [{ rowNumber: 2, cleanedMessage: "Joker Oslo" }],
    });

    getMessageCleanupSettingsMock.mockReset();
    getMessageCleanupSettingsMock.mockResolvedValue({
      modelId: undefined,
      prompt: undefined,
    });
  });

  it("returns 400 when the payload is missing required fields", async () => {
    const response = await POST(jsonRequest({ sessionId: "session-1" }));

    expect(response.status).toBe(400);
    expect(runCleanupChunkMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the session has no staged rows", async () => {
    prismaMock.importReviewRow.findMany.mockResolvedValue([]);

    const response = await POST(
      jsonRequest({ sessionId: "session-missing", chunkIndex: 0 }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "IMPORT_REVIEW_SESSION_NOT_FOUND",
      message: "Import review session was not found or already submitted.",
    });
  });

  it("returns 400 when chunkIndex does not match a chunk in the plan", async () => {
    const response = await POST(
      jsonRequest({ sessionId: "session-1", chunkIndex: 5 }),
    );

    expect(response.status).toBe(400);
    expect(runCleanupChunkMock).not.toHaveBeenCalled();
  });

  it("re-derives chunk boundaries and maps provider rowNumbers back to rowIds", async () => {
    const response = await POST(
      jsonRequest({ sessionId: "session-1", chunkIndex: 0 }),
    );

    expect(runCleanupChunkMock).toHaveBeenCalledWith(
      expect.objectContaining({
        rows: [
          { rowNumber: 2, message: "Joker Oslo" },
          { rowNumber: 3, message: "Ruter" },
        ],
      }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      index: 0,
      status: "ok",
      suggestions: [{ rowId: "row-1", cleanedMessage: "Joker Oslo" }],
    });
  });

  it("passes through a failed chunk result without a rowId mapping, as a 200 body", async () => {
    runCleanupChunkMock.mockResolvedValue({
      status: "failed",
      reason: "provider_error",
    });

    const response = await POST(
      jsonRequest({ sessionId: "session-1", chunkIndex: 0 }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      index: 0,
      status: "failed",
      reason: "provider_error",
    });
  });
});
