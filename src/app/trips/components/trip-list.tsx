import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TripListItem } from "@/lib/trips/summary";
import { formatAmount, formatDays, formatTripRange } from "../format";

export function TripList({ trips }: { trips: TripListItem[] }) {
  return (
    <div className="rounded-md border border-border">
      <Table aria-label="Turer" className="min-w-3xl table-fixed">
        <colgroup>
          <col />
          <col className="w-56" />
          <col className="w-24" />
          <col className="w-32" />
          <col className="w-28" />
        </colgroup>
        <TableHeader>
          <TableRow>
            <TableHead>Tur</TableHead>
            <TableHead>Datoer</TableHead>
            <TableHead className="text-right">Dager</TableHead>
            <TableHead className="text-right">Kostnad</TableHead>
            <TableHead className="text-right">Per dag</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {trips.map((trip) => (
            <TableRow key={trip.id}>
              <TableCell className="truncate font-medium">
                <Link
                  href={`/trips/${trip.id}`}
                  className="underline-offset-4 hover:underline"
                >
                  {trip.name}
                </Link>
              </TableCell>
              <TableCell className="tabular-nums">
                {formatTripRange(trip.startDate, trip.endDate)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatDays(trip.days)}
              </TableCell>
              {trip.transactionCount > 0 ? (
                <>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatAmount(trip.costNok)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatAmount(trip.perDayNok)}
                  </TableCell>
                </>
              ) : (
                <TableCell
                  colSpan={2}
                  className="text-right text-muted-foreground"
                >
                  Ingen transaksjoner ennå
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
