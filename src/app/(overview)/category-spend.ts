import type { DashboardAnalytics } from "./overview-dashboard.types";

export type CategoryRow = DashboardAnalytics["categoryBreakdown"][number];
export type CategoryKey = string;

export function getCategoryKey(row: CategoryRow): CategoryKey {
  return row.categoryId ?? "uncategorized";
}

export function averageSpend(row: CategoryRow) {
  return row.transactionCount > 0 ? row.spendNok / row.transactionCount : 0;
}

export type CategorySort = "amount" | "count" | "average";

type CategorySortSpec = {
  label: string;
  value: (row: CategoryRow) => number;
  tracksCumulativeShare: boolean;
};

export const CATEGORY_SORTS: Record<CategorySort, CategorySortSpec> = {
  amount: {
    label: "Beløp",
    value: (row) => row.spendNok,
    tracksCumulativeShare: true,
  },
  count: {
    label: "Antall",
    value: (row) => row.transactionCount,
    tracksCumulativeShare: false,
  },
  average: {
    label: "Snitt per kjøp",
    value: averageSpend,
    tracksCumulativeShare: false,
  },
};

export const CUT_SHARE = 0.8;

export type CategoryLedgerRow = CategoryRow & {
  share: number;
  cumulativeShare: number | null;
  barRatio: number;
};

export type CategoryLedger = {
  total: number;
  rows: CategoryLedgerRow[];
  cutAfterIndex: number | null;
};

function sumSpend(rows: readonly CategoryRow[]) {
  return rows.reduce((sum, row) => sum + row.spendNok, 0);
}

export function buildCategoryLedger(
  visibleRows: readonly CategoryRow[],
  sort: CategorySort,
): CategoryLedger {
  const { value, tracksCumulativeShare } = CATEGORY_SORTS[sort];
  const total = sumSpend(visibleRows);
  const sorted = [...visibleRows].sort((a, b) => value(b) - value(a));
  const largest = Math.max(0, ...sorted.map(value));

  let runningSpend = 0;
  let cutAfterIndex: number | null = null;
  const rows = sorted.map((row, index) => {
    runningSpend += row.spendNok;
    const cumulativeShare =
      tracksCumulativeShare && total > 0 ? runningSpend / total : null;
    if (
      cutAfterIndex === null &&
      cumulativeShare !== null &&
      cumulativeShare >= CUT_SHARE &&
      index < sorted.length - 1
    ) {
      cutAfterIndex = index;
    }

    return {
      ...row,
      share: total > 0 ? row.spendNok / total : 0,
      cumulativeShare,
      barRatio: largest > 0 ? value(row) / largest : 0,
    };
  });

  return { total, rows, cutAfterIndex };
}

export type ShareMapItem =
  | { kind: "category"; row: CategoryRow }
  | {
      kind: "other";
      members: CategoryRow[];
      spendNok: number;
      transactionCount: number;
    };

export function shareMapItemSpend(item: ShareMapItem) {
  return item.kind === "category" ? item.row.spendNok : item.spendNok;
}

export const SMALL_CATEGORY_SHARE = 0.03;

export function mergeSmallCategories(
  rows: readonly CategoryRow[],
  threshold = SMALL_CATEGORY_SHARE,
): ShareMapItem[] {
  const total = sumSpend(rows);
  const isSmall = (row: CategoryRow) =>
    total > 0 && row.spendNok / total < threshold;
  const small = rows.filter(isSmall);

  if (small.length < 2) {
    return rows.map((row) => ({ kind: "category", row }));
  }

  return [
    ...rows
      .filter((row) => !isSmall(row))
      .map((row): ShareMapItem => ({ kind: "category", row })),
    {
      kind: "other",
      members: small,
      spendNok: sumSpend(small),
      transactionCount: small.reduce(
        (sum, row) => sum + row.transactionCount,
        0,
      ),
    },
  ];
}

export type TreemapTile = {
  item: ShareMapItem;
  x: number;
  y: number;
  width: number;
  height: number;
};

type Rect = Omit<TreemapTile, "item">;

function splitIntoTiles(
  items: readonly ShareMapItem[],
  rect: Rect,
  tiles: TreemapTile[],
) {
  if (items.length === 0) {
    return;
  }
  if (items.length === 1) {
    tiles.push({ item: items[0], ...rect });
    return;
  }

  const total = items.reduce((sum, item) => sum + shareMapItemSpend(item), 0);
  let splitAt = 1;
  let closest = Number.POSITIVE_INFINITY;
  let running = 0;
  for (let index = 0; index < items.length - 1; index += 1) {
    running += shareMapItemSpend(items[index]);
    const distance = Math.abs(running - total / 2);
    if (distance < closest) {
      closest = distance;
      splitAt = index + 1;
    }
  }

  const first = items.slice(0, splitAt);
  const second = items.slice(splitAt);
  const ratio =
    total > 0
      ? first.reduce((sum, item) => sum + shareMapItemSpend(item), 0) / total
      : first.length / items.length;

  if (rect.width >= rect.height) {
    const firstWidth = rect.width * ratio;
    splitIntoTiles(first, { ...rect, width: firstWidth }, tiles);
    splitIntoTiles(
      second,
      { ...rect, x: rect.x + firstWidth, width: rect.width - firstWidth },
      tiles,
    );
  } else {
    const firstHeight = rect.height * ratio;
    splitIntoTiles(first, { ...rect, height: firstHeight }, tiles);
    splitIntoTiles(
      second,
      { ...rect, y: rect.y + firstHeight, height: rect.height - firstHeight },
      tiles,
    );
  }
}

export function layoutTreemap(
  items: readonly ShareMapItem[],
  size: { width: number; height: number },
): TreemapTile[] {
  const sorted = [...items].sort(
    (a, b) => shareMapItemSpend(b) - shareMapItemSpend(a),
  );
  const tiles: TreemapTile[] = [];
  splitIntoTiles(sorted, { x: 0, y: 0, ...size }, tiles);
  return tiles;
}
