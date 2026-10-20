import { describe, expect, it } from "vitest";
import {
  buildCategoryLedger,
  type CategoryRow,
  layoutTreemap,
  mergeSmallCategories,
  type ShareMapItem,
} from "./category-spend";

function row(
  categoryId: string | null,
  spendNok: number,
  transactionCount = 1,
): CategoryRow {
  return {
    categoryId,
    categoryName: categoryId ?? "Ukategorisert",
    spendNok,
    transactionCount,
  };
}

const MONTH: CategoryRow[] = [
  row("housing", 5000, 1),
  row("food", 2000, 20),
  row("car", 1500, 3),
  row("fun", 1000, 4),
  row("health", 500, 2),
];

describe("buildCategoryLedger", () => {
  it("cuts after the first row where the cumulative share reaches 80 %", () => {
    const ledger = buildCategoryLedger(MONTH, "amount");

    expect(ledger.total).toBe(10000);
    expect(ledger.cutAfterIndex).toBe(2);
    expect(
      ledger.rows.map((entry) => [
        entry.categoryId,
        entry.share,
        entry.cumulativeShare,
        entry.barRatio,
      ]),
    ).toEqual([
      ["housing", 0.5, 0.5, 1],
      ["food", 0.2, 0.7, 0.4],
      ["car", 0.15, 0.85, 0.3],
      ["fun", 0.1, 0.95, 0.2],
      ["health", 0.05, 1, 0.1],
    ]);
  });

  it("measures shares and the cut against the visible rows once one is removed", () => {
    const withoutHousing = MONTH.filter(
      (entry) => entry.categoryId !== "housing",
    );

    const ledger = buildCategoryLedger(withoutHousing, "amount");

    expect(ledger.total).toBe(5000);
    expect(ledger.cutAfterIndex).toBe(2);
    expect(
      ledger.rows.map((entry) => [
        entry.categoryId,
        entry.share,
        entry.cumulativeShare,
        entry.barRatio,
      ]),
    ).toEqual([
      ["food", 0.4, 0.4, 1],
      ["car", 0.3, 0.7, 0.75],
      ["fun", 0.2, 0.9, 0.5],
      ["health", 0.1, 1, 0.25],
    ]);
  });

  it("ranks by transaction count with no cumulative column and no cut", () => {
    const ledger = buildCategoryLedger(MONTH, "count");

    expect(ledger.cutAfterIndex).toBeNull();
    expect(
      ledger.rows.map((entry) => [
        entry.categoryId,
        entry.cumulativeShare,
        entry.barRatio,
      ]),
    ).toEqual([
      ["food", null, 1],
      ["fun", null, 0.2],
      ["car", null, 0.15],
      ["health", null, 0.1],
      ["housing", null, 0.05],
    ]);
  });

  it("ranks by average spend per transaction", () => {
    const ledger = buildCategoryLedger(MONTH, "average");

    expect(ledger.cutAfterIndex).toBeNull();
    expect(
      ledger.rows.map((entry) => [entry.categoryId, entry.barRatio]),
    ).toEqual([
      ["housing", 1],
      ["car", 0.1],
      ["fun", 0.05],
      ["health", 0.05],
      ["food", 0.02],
    ]);
  });

  it("has no cut when the last row is the first to reach 80 %", () => {
    const ledger = buildCategoryLedger(
      [row("a", 600), row("b", 400)],
      "amount",
    );

    expect(ledger.rows.map((entry) => entry.cumulativeShare)).toEqual([0.6, 1]);
    expect(ledger.cutAfterIndex).toBeNull();
  });
});

describe("mergeSmallCategories", () => {
  it("folds every category under 3 % of the visible total into one Andre item", () => {
    const rows = [
      row("housing", 9000, 1),
      row("food", 700, 7),
      row("snacks", 200, 4),
      row(null, 100, 2),
    ];

    expect(mergeSmallCategories(rows)).toEqual([
      { kind: "category", row: rows[0] },
      { kind: "category", row: rows[1] },
      {
        kind: "other",
        members: [rows[2], rows[3]],
        spendNok: 300,
        transactionCount: 6,
      },
    ]);
  });

  it("keeps a lone small category as itself instead of a one-member Andre", () => {
    const rows = [row("housing", 9000), row("food", 800), row("snacks", 200)];

    expect(mergeSmallCategories(rows)).toEqual([
      { kind: "category", row: rows[0] },
      { kind: "category", row: rows[1] },
      { kind: "category", row: rows[2] },
    ]);
  });
});

describe("layoutTreemap", () => {
  const WIDTH = 600;
  const HEIGHT = 380;
  const items: ShareMapItem[] = [
    row("b", 2000),
    row("a", 5000),
    row("d", 500),
    row("c", 1500),
    row("e", 1000),
  ].map((entry) => ({ kind: "category", row: entry }));

  const tiles = layoutTreemap(items, { width: WIDTH, height: HEIGHT });

  it("gives each item an area proportional to its share of the total", () => {
    const areaById = Object.fromEntries(
      tiles.map((tile) => [
        tile.item.kind === "category" ? tile.item.row.categoryId : "other",
        Math.round(tile.width * tile.height),
      ]),
    );

    expect(areaById).toEqual({
      a: 114000,
      b: 45600,
      c: 34200,
      e: 22800,
      d: 11400,
    });
  });

  it("splits the largest item off along the longer side first", () => {
    expect(tiles[0]).toMatchObject({ x: 0, y: 0, width: 300, height: 380 });
  });

  it("keeps every tile inside the bounds without overlapping another", () => {
    expect(tiles).toHaveLength(5);

    for (const tile of tiles) {
      expect(tile.x).toBeGreaterThanOrEqual(0);
      expect(tile.y).toBeGreaterThanOrEqual(0);
      expect(tile.x + tile.width).toBeLessThanOrEqual(WIDTH + 1e-9);
      expect(tile.y + tile.height).toBeLessThanOrEqual(HEIGHT + 1e-9);
    }

    for (const [index, first] of tiles.entries()) {
      for (const second of tiles.slice(index + 1)) {
        const overlapWidth =
          Math.min(first.x + first.width, second.x + second.width) -
          Math.max(first.x, second.x);
        const overlapHeight =
          Math.min(first.y + first.height, second.y + second.height) -
          Math.max(first.y, second.y);
        expect(
          Math.max(0, overlapWidth) * Math.max(0, overlapHeight),
        ).toBeLessThan(1e-6);
      }
    }
  });
});
