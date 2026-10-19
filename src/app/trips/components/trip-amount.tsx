import { cn } from "@/lib/utils";
import { formatAmount } from "../format";

/** A signed transaction amount, styled like the /transactions amount column. */
export function TransactionAmount({ amountNok }: { amountNok: number }) {
  return (
    <span
      className={cn("font-mono tabular-nums", amountNok > 0 && "text-success")}
    >
      {formatAmount(amountNok)}
    </span>
  );
}
