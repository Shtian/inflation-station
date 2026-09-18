import type { ResolvedRowMessage } from "./resolve-row-message";

export type CleanupStreamStatus = {
  total: number;
  cleaned: number;
  pending: number;
  failed: number;
};

export function deriveCleanupStreamStatus(
  resolvedMessages: Record<string, ResolvedRowMessage>,
): CleanupStreamStatus {
  return Object.values(resolvedMessages).reduce<CleanupStreamStatus>(
    (status, row) => ({
      total: status.total + 1,
      cleaned: status.cleaned + (row.hasCleanedAlternative ? 1 : 0),
      pending: status.pending + (row.isPending ? 1 : 0),
      failed: status.failed + (row.isUnavailable ? 1 : 0),
    }),
    { total: 0, cleaned: 0, pending: 0, failed: 0 },
  );
}
