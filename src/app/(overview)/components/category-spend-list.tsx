import { EyeOffIcon } from "lucide-react";
import { Fragment } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCategoryColor } from "@/lib/category-color";
import { cn } from "@/lib/utils";
import {
  averageSpend,
  type CategoryKey,
  type CategoryLedger,
  CUT_SHARE,
  getCategoryKey,
} from "../category-spend";
import {
  formatCount,
  formatPercent,
  formatWholeNok,
} from "../overview-dashboard.utils";

type CategorySpendListProps = {
  ledger: CategoryLedger;
  canHide: boolean;
  onHide: (key: CategoryKey) => void;
};

const COLUMN_COUNT = 7;
const WIDE_ONLY = "hidden md:table-cell";
const HEAD = "font-medium text-muted-foreground text-xs";
const AMOUNT_HEAD = cn(HEAD, "text-right");

export function CategorySpendList({
  ledger,
  canHide,
  onHide,
}: CategorySpendListProps) {
  const { rows, cutAfterIndex } = ledger;

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className={HEAD}>Kategori</TableHead>
          <TableHead className="w-[42%]">
            <span className="sr-only">Andel som stolpe</span>
          </TableHead>
          <TableHead className={AMOUNT_HEAD}>Beløp</TableHead>
          <TableHead className={AMOUNT_HEAD}>Andel</TableHead>
          <TableHead className={cn(WIDE_ONLY, AMOUNT_HEAD)}>
            Akkumulert
          </TableHead>
          <TableHead className={cn(WIDE_ONLY, AMOUNT_HEAD)}>Antall</TableHead>
          <TableHead className={cn(WIDE_ONLY, AMOUNT_HEAD)}>Snitt</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => {
          const key = getCategoryKey(row);
          const color = getCategoryColor(row.categoryName).backgroundColor;
          const isPastCut = cutAfterIndex !== null && index > cutAfterIndex;

          return (
            <Fragment key={key}>
              <TableRow
                className={cn(
                  "group/row hover:bg-muted",
                  isPastCut && "text-muted-foreground",
                )}
              >
                <TableCell>
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="size-2.5 shrink-0 rounded-[3px]"
                      style={{ backgroundColor: color }}
                    />
                    {row.categoryName}
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Skjul ${row.categoryName}`}
                      disabled={!canHide}
                      onClick={() => onHide(key)}
                      className="opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100 focus-visible:opacity-100"
                    >
                      <EyeOffIcon />
                    </Button>
                  </span>
                </TableCell>
                <TableCell>
                  <div className="relative h-2.5 overflow-hidden rounded-[3px] bg-foreground/6">
                    <div
                      className="absolute inset-y-0 left-0 rounded-[3px] motion-safe:transition-[width] motion-safe:duration-500"
                      style={{
                        width: `${row.barRatio * 100}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatWholeNok(row.spendNok)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPercent(row.share)}
                </TableCell>
                <TableCell
                  className={cn(
                    WIDE_ONLY,
                    "text-right text-xs text-muted-foreground tabular-nums",
                  )}
                >
                  {row.cumulativeShare === null
                    ? "–"
                    : formatPercent(row.cumulativeShare)}
                </TableCell>
                <TableCell className={cn(WIDE_ONLY, "text-right tabular-nums")}>
                  {row.transactionCount}
                </TableCell>
                <TableCell className={cn(WIDE_ONLY, "text-right tabular-nums")}>
                  {formatWholeNok(averageSpend(row))}
                </TableCell>
              </TableRow>
              {index === cutAfterIndex ? (
                <TableRow className="border-0 hover:bg-transparent">
                  <TableCell colSpan={COLUMN_COUNT} className="px-2 py-2">
                    <div className="flex items-center gap-2.5 text-xs text-muted-foreground before:flex-1 before:border-t before:border-dashed before:border-border after:flex-1 after:border-t after:border-dashed after:border-border">
                      {formatPercent(CUT_SHARE)} av forbruket er nådd ·{" "}
                      {formatCount(
                        rows.length - index - 1,
                        "kategori deler",
                        "kategorier deler",
                      )}{" "}
                      resten
                    </div>
                  </TableCell>
                </TableRow>
              ) : null}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}
