import { TransactionAmount } from "@/app/trips/components/trip-amount";
import { formatDay } from "@/app/trips/format";
import { CategoryBadge } from "@/components/category-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UNCATEGORIZED_CATEGORY_NAME } from "@/lib/category-color";
import { isTransfer } from "@/lib/transactions/transfer";
import type { TripTransaction } from "@/lib/trips/summary";
import { RemoveFromTripButton } from "./remove-from-trip-button";

export function TripTransactions({
  tripId,
  label,
  transactions,
}: {
  tripId: string;
  label: string;
  transactions: TripTransaction[];
}) {
  return (
    <div className="rounded-md border border-border">
      <Table aria-label={label} className="min-w-2xl table-fixed">
        <colgroup>
          <col className="w-32" />
          <col />
          <col className="w-44" />
          <col className="w-32" />
          <col className="w-24" />
        </colgroup>
        <TableHeader>
          <TableRow>
            <TableHead>Dato</TableHead>
            <TableHead>Brukersted</TableHead>
            <TableHead>Kategori</TableHead>
            <TableHead className="text-right">Beløp</TableHead>
            <TableHead>
              <span className="sr-only">Handlinger</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((transaction) => (
            <TableRow key={transaction.id}>
              <TableCell className="tabular-nums">
                {formatDay(transaction.bookingDate)}
              </TableCell>
              <TableCell>
                <div className="truncate">{transaction.merchant}</div>
                {isTransfer(transaction) ? (
                  <div className="truncate text-xs text-muted-foreground">
                    Ikke med i totalen
                  </div>
                ) : null}
              </TableCell>
              <TableCell>
                <CategoryBadge
                  label={
                    transaction.category?.name ?? UNCATEGORIZED_CATEGORY_NAME
                  }
                />
              </TableCell>
              <TableCell className="text-right">
                <TransactionAmount amountNok={transaction.amountNok} />
              </TableCell>
              <TableCell className="text-right">
                <RemoveFromTripButton
                  tripId={tripId}
                  transactionId={transaction.id}
                  merchant={transaction.merchant}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
