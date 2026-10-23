import { XIcon } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { getCategoryColor } from "@/lib/category-color";
import {
  averageSpend,
  buildCategoryLedger,
  CATEGORY_SORTS,
  type CategoryKey,
  type CategoryLedger,
  type CategoryRow,
  type CategorySort,
  getCategoryKey,
  mergeSmallCategories,
  SMALL_CATEGORY_SHARE,
} from "../category-spend";
import type { DashboardAnalytics } from "../overview-dashboard.types";
import {
  formatCount,
  formatNameList,
  formatPercent,
  formatWholeNok,
} from "../overview-dashboard.utils";
import { CategoryShareMap } from "./category-share-map";
import { CategorySpendList } from "./category-spend-list";

type CategorySpendBreakdownCardProps = {
  isLoading: boolean;
  categoryBreakdown: DashboardAnalytics["categoryBreakdown"] | undefined;
  filterKey: string;
};

type CategoryView = "list" | "map";

const VIEWS: Record<CategoryView, string> = {
  list: "Liste",
  map: "Andelskart",
};

const SORTS = Object.entries(CATEGORY_SORTS) as Array<
  [CategorySort, (typeof CATEGORY_SORTS)[CategorySort]]
>;

const NO_HIDDEN: ReadonlySet<CategoryKey> = new Set();

function Strong({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-foreground">{children}</strong>;
}

const LIST_LEDES: Record<CategorySort, (ledger: CategoryLedger) => ReactNode> =
  {
    amount: ({ total, rows }) => {
      const spent = (
        <>
          <Strong>{formatWholeNok(total)}</Strong> brukt i perioden.
        </>
      );
      if (rows.length === 1) {
        return (
          <>
            {spent} Alt gikk til {rows[0].categoryName}.
          </>
        );
      }
      const top = rows.slice(0, Math.min(3, rows.length - 1));
      const topShare = top.reduce((sum, row) => sum + row.share, 0);
      return (
        <>
          {spent} {formatNameList(top.map((row) => row.categoryName))} står for{" "}
          <Strong>{formatPercent(topShare)}</Strong>.
        </>
      );
    },
    count: ({ rows }) => (
      <>
        Flest kjøp: <Strong>{rows[0].categoryName}</Strong> med{" "}
        {formatCount(rows[0].transactionCount, "transaksjon", "transaksjoner")}.
        Mange små kjøp er der vanene ligger.
      </>
    ),
    average: ({ rows }) => (
      <>
        Dyreste enkeltkjøp i snitt: <Strong>{rows[0].categoryName}</Strong>,{" "}
        {formatWholeNok(averageSpend(rows[0]))} per transaksjon.
      </>
    ),
  };

function mapLede(visibleRows: CategoryRow[], total: number) {
  const largest = visibleRows.reduce((max, row) =>
    row.spendNok > max.spendNok ? row : max,
  );
  return (
    <>
      Hver flate er like stor som beløpet.{" "}
      <Strong>{largest.categoryName}</Strong> alene er{" "}
      {formatPercent(total > 0 ? largest.spendNok / total : 0)} av{" "}
      {formatWholeNok(total)}.
    </>
  );
}

function useHiddenCategories(filterKey: string) {
  const [state, setState] = useState({ filterKey, hidden: NO_HIDDEN });
  const hidden = state.filterKey === filterKey ? state.hidden : NO_HIDDEN;
  const update = (next: (current: Set<CategoryKey>) => void) => {
    const copy = new Set(hidden);
    next(copy);
    setState({ filterKey, hidden: copy });
  };

  return {
    hidden,
    hide: (key: CategoryKey) => update((set) => set.add(key)),
    show: (key: CategoryKey) => update((set) => set.delete(key)),
    showAll: () => setState({ filterKey, hidden: NO_HIDDEN }),
  };
}

export function CategorySpendBreakdownCard({
  isLoading,
  categoryBreakdown,
  filterKey,
}: CategorySpendBreakdownCardProps) {
  const [view, setView] = useState<CategoryView>("list");
  const [sort, setSort] = useState<CategorySort>("amount");
  const [mergeSmall, setMergeSmall] = useState(true);
  const mergeSmallId = useId();
  const { hidden, hide, show, showAll } = useHiddenCategories(filterKey);

  const rows = categoryBreakdown ?? [];
  const visibleRows = rows.filter((row) => !hidden.has(getCategoryKey(row)));
  const hiddenRows = rows.filter((row) => hidden.has(getCategoryKey(row)));
  const canHide = visibleRows.length > 1;
  const hideCategory = (key: CategoryKey) => {
    if (canHide) {
      hide(key);
    }
  };
  const hasData = !isLoading && visibleRows.length > 0;
  const ledger = buildCategoryLedger(visibleRows, sort);

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-[62ch] min-w-0 space-y-1">
            <h3 className="text-sm font-semibold text-foreground">
              Forbruk per kategori
            </h3>
            {hasData ? (
              <p className="text-sm text-muted-foreground">
                {view === "list"
                  ? LIST_LEDES[sort](ledger)
                  : mapLede(visibleRows, ledger.total)}
              </p>
            ) : null}
            {hasData && hiddenRows.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                {formatCount(
                  hiddenRows.length,
                  "kategori skjult",
                  "kategorier skjult",
                )}{" "}
                (
                {formatWholeNok(
                  hiddenRows.reduce((sum, row) => sum + row.spendNok, 0),
                )}
                )
              </p>
            ) : null}
          </div>
          {hasData ? (
            <div className="ml-auto flex flex-col items-end gap-2">
              <ButtonGroup aria-label="Visning">
                {Object.entries(VIEWS).map(([value, label]) => (
                  <Button
                    key={value}
                    size="sm"
                    variant={view === value ? "default" : "outline"}
                    aria-pressed={view === value}
                    onClick={() => setView(value as CategoryView)}
                  >
                    {label}
                  </Button>
                ))}
              </ButtonGroup>
              {view === "list" ? (
                <ButtonGroup aria-label="Sorter etter">
                  {SORTS.map(([value, spec]) => (
                    <Button
                      key={value}
                      size="xs"
                      variant={sort === value ? "secondary" : "ghost"}
                      aria-pressed={sort === value}
                      onClick={() => setSort(value)}
                    >
                      {spec.label}
                    </Button>
                  ))}
                </ButtonGroup>
              ) : (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={mergeSmallId}
                    checked={mergeSmall}
                    onCheckedChange={(checked) => setMergeSmall(checked)}
                  />
                  <Label
                    htmlFor={mergeSmallId}
                    className="cursor-pointer text-xs font-normal text-muted-foreground"
                  >
                    Slå sammen små kategorier (under{" "}
                    {formatPercent(SMALL_CATEGORY_SHARE)})
                  </Label>
                </div>
              )}
            </div>
          ) : null}
        </div>
        {isLoading ? (
          <output className="block text-sm text-muted-foreground">
            Laster inn diagramdata…
          </output>
        ) : null}
        {!isLoading && rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ingen forbruksdata for valgte filtre.
          </p>
        ) : null}
        {hasData && hiddenRows.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Skjult:</span>
            {hiddenRows.map((row) => (
              <Button
                key={getCategoryKey(row)}
                size="xs"
                variant="outline"
                aria-label={`Vis ${row.categoryName}`}
                onClick={() => show(getCategoryKey(row))}
              >
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-[3px]"
                  style={{
                    backgroundColor: getCategoryColor(row.categoryName)
                      .backgroundColor,
                  }}
                />
                {row.categoryName}
                <XIcon />
              </Button>
            ))}
            <Button size="xs" variant="ghost" onClick={showAll}>
              Vis alle
            </Button>
          </div>
        ) : null}
        {hasData && view === "list" ? (
          <CategorySpendList
            ledger={ledger}
            canHide={canHide}
            onHide={hideCategory}
          />
        ) : null}
        {hasData && view === "map" ? (
          <CategoryShareMap
            items={
              mergeSmall
                ? mergeSmallCategories(visibleRows)
                : visibleRows.map((row) => ({ kind: "category", row }))
            }
            total={ledger.total}
            canHide={canHide}
            onHide={hideCategory}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
