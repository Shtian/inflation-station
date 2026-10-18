import { isTransfer } from "@/lib/transactions/transfer";
import {
  addCadencePeriod,
  CADENCES,
  type Cadence,
  type Charge,
  daysBetween,
  type IsoDay,
  median,
  type RecurringCandidate,
  roundNok,
} from "./model";

export type SubscriptionTransaction = {
  id: string;
  bookingDate: IsoDay;
  /** Signed: negative for spending. */
  amountNok: number;
  normalizedMerchant: string;
  merchant: string | null;
  category: { kind: string } | null;
};

type MerchantCharge = Charge & { merchant: string | null };

const MIN_CHARGES = 3;
const AMOUNT_TOLERANCE = 0.15;

export function detectRecurringCharges(
  transactions: readonly SubscriptionTransaction[],
): RecurringCandidate[] {
  const candidates: RecurringCandidate[] = [];

  for (const [normalizedMerchant, charges] of groupExpensesByMerchant(
    transactions,
  )) {
    clusterByAmount(charges).forEach((cluster, index) => {
      if (cluster.length < MIN_CHARGES) {
        return;
      }
      const byDate = [...cluster].sort((a, b) => a.date.localeCompare(b.date));
      const cadence = matchCadence(byDate.map((charge) => charge.date));
      if (cadence) {
        candidates.push(
          toCandidate(normalizedMerchant, cadence, byDate, index),
        );
      }
    });
  }

  return candidates.sort(
    (a, b) =>
      a.displayName.localeCompare(b.displayName, "nb") ||
      a.key.localeCompare(b.key),
  );
}

function groupExpensesByMerchant(
  transactions: readonly SubscriptionTransaction[],
): Map<string, MerchantCharge[]> {
  const groups = new Map<string, MerchantCharge[]>();

  for (const transaction of transactions) {
    if (
      transaction.amountNok >= 0 ||
      isTransfer(transaction) ||
      transaction.normalizedMerchant === ""
    ) {
      continue;
    }
    const charges = groups.get(transaction.normalizedMerchant) ?? [];
    charges.push({
      transactionId: transaction.id,
      date: transaction.bookingDate,
      amountNok: -transaction.amountNok,
      merchant: transaction.merchant,
    });
    groups.set(transaction.normalizedMerchant, charges);
  }

  return groups;
}

/**
 * Splits one merchant's charges into groups whose members all sit within the
 * tolerance of the group median, so two plans at one merchant stay apart.
 */
function clusterByAmount(charges: MerchantCharge[]): MerchantCharge[][] {
  const clusters: MerchantCharge[][] = [];
  const byAmount = [...charges].sort(
    (a, b) => a.amountNok - b.amountNok || a.date.localeCompare(b.date),
  );

  for (const charge of byAmount) {
    const current = clusters.at(-1);
    if (current && isTightCluster([...current, charge])) {
      current.push(charge);
    } else {
      clusters.push([charge]);
    }
  }

  return clusters;
}

function isTightCluster(charges: readonly MerchantCharge[]): boolean {
  const center = median(charges.map((charge) => charge.amountNok));
  return charges.every(
    (charge) =>
      Math.abs(charge.amountNok - center) <= center * AMOUNT_TOLERANCE,
  );
}

function matchCadence(dates: readonly IsoDay[]): Cadence | null {
  const intervals = dates
    .slice(1)
    .map((date, index) => daysBetween(dates[index], date));

  for (const [cadence, rule] of Object.entries(CADENCES) as [
    Cadence,
    (typeof CADENCES)[Cadence],
  ][]) {
    const { band, skipBand } = rule;
    const regular = intervals.filter((days) => isWithin(days, band));
    const skipped = skipBand
      ? intervals.filter((days) => isWithin(days, skipBand))
      : [];
    const allFit = regular.length + skipped.length === intervals.length;
    if (allFit && regular.length * 2 >= intervals.length) {
      return cadence;
    }
  }

  return null;
}

function isWithin(days: number, [min, max]: readonly [number, number]) {
  return days >= min && days <= max;
}

function toCandidate(
  normalizedMerchant: string,
  cadence: Cadence,
  byDate: readonly MerchantCharge[],
  clusterIndex: number,
): RecurringCandidate {
  const latest = byDate[byDate.length - 1];

  return {
    key: `${normalizedMerchant}|${cadence}|${clusterIndex}`,
    normalizedMerchant,
    displayName: latest.merchant ?? normalizedMerchant,
    cadence,
    charges: byDate.map(({ transactionId, date, amountNok }) => ({
      transactionId,
      date,
      amountNok,
    })),
    typicalAmountNok: roundNok(
      median(byDate.map((charge) => charge.amountNok)),
    ),
    currentAmountNok: latest.amountNok,
    annualizedNok: roundNok(latest.amountNok * CADENCES[cadence].perYear),
    lastChargeDate: latest.date,
    nextExpectedDate: addCadencePeriod(latest.date, cadence),
  };
}
