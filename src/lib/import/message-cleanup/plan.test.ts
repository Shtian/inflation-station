import { describe, expect, it } from "vitest";
import {
  type CleanupCandidate,
  planCleanupChunks,
  toCleanupCandidates,
  toCleanupMessage,
} from "./plan";

function candidate(overrides?: Partial<CleanupCandidate>): CleanupCandidate {
  return { rowId: "row-1", rowNumber: 2, message: "Joker Oslo", ...overrides };
}

describe("toCleanupMessage", () => {
  it("joins name and title, trimmed", () => {
    expect(toCleanupMessage({ name: " Joker ", title: " Oslo " })).toBe(
      "Joker   Oslo",
    );
    expect(toCleanupMessage({ name: "Joker", title: "" })).toBe("Joker");
  });
});

describe("toCleanupCandidates", () => {
  it("excludes rows whose name and title are both blank", () => {
    const result = toCleanupCandidates([
      { id: "row-1", rowNumber: 2, name: "Joker", title: "Oslo" },
      { id: "row-2", rowNumber: 3, name: "  ", title: "" },
    ]);

    expect(result).toEqual([
      { rowId: "row-1", rowNumber: 2, message: "Joker Oslo" },
    ]);
  });
});

describe("planCleanupChunks", () => {
  it("short-circuits with disabled before chunking", () => {
    const plan = planCleanupChunks({
      sessionId: "session-1",
      disabledReason: "disabled",
      candidates: [
        candidate({ rowId: "row-1" }),
        candidate({ rowId: "row-2" }),
      ],
    });

    expect(plan).toEqual({
      status: "unavailable",
      reason: "disabled",
      rowIds: ["row-1", "row-2"],
    });
  });

  it("short-circuits with key_missing before chunking", () => {
    const plan = planCleanupChunks({
      sessionId: "session-1",
      disabledReason: "key_missing",
      candidates: [candidate({ rowId: "row-1" })],
    });

    expect(plan).toEqual({
      status: "unavailable",
      reason: "key_missing",
      rowIds: ["row-1"],
    });
  });

  it("partitions candidates into chunks of the given size, exactly", () => {
    const candidates = [
      candidate({ rowId: "row-1", rowNumber: 2 }),
      candidate({ rowId: "row-2", rowNumber: 3 }),
      candidate({ rowId: "row-3", rowNumber: 4 }),
      candidate({ rowId: "row-4", rowNumber: 5 }),
      candidate({ rowId: "row-5", rowNumber: 6 }),
    ];

    const plan = planCleanupChunks({
      sessionId: "session-1",
      disabledReason: null,
      candidates,
      chunkSize: 2,
    });

    expect(plan).toEqual({
      status: "planned",
      sessionId: "session-1",
      chunks: [
        { index: 0, rowIds: ["row-1", "row-2"] },
        { index: 1, rowIds: ["row-3", "row-4"] },
        { index: 2, rowIds: ["row-5"] },
      ],
    });
  });

  it("produces identical output regardless of input order", () => {
    const sorted = [
      candidate({ rowId: "row-1", rowNumber: 2 }),
      candidate({ rowId: "row-2", rowNumber: 3 }),
      candidate({ rowId: "row-3", rowNumber: 4 }),
    ];
    const unsorted = [sorted[2], sorted[0], sorted[1]];

    const sortedPlan = planCleanupChunks({
      sessionId: "session-1",
      disabledReason: null,
      candidates: sorted,
      chunkSize: 2,
    });
    const unsortedPlan = planCleanupChunks({
      sessionId: "session-1",
      disabledReason: null,
      candidates: unsorted,
      chunkSize: 2,
    });

    expect(unsortedPlan).toEqual(sortedPlan);
  });

  it("returns an empty chunk list for no candidates", () => {
    const plan = planCleanupChunks({
      sessionId: "session-1",
      disabledReason: null,
      candidates: [],
    });

    expect(plan).toEqual({
      status: "planned",
      sessionId: "session-1",
      chunks: [],
    });
  });
});
