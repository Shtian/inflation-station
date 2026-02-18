import {
  CheckCircle2,
  DownloadCloud,
  Loader2,
  Pencil,
  RotateCcw,
} from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import {
  ImportReviewTable,
  type MessageSource,
  type ReviewRow,
  ReviewTableSkeleton,
} from "../import-review-table";
import type {
  Category,
  ParseResponse,
  ProviderDetection,
} from "../use-import-workflow";

function formatNok(value: number) {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

type AccountSummary = {
  id: string;
  name: string;
};

type ImportReviewPhaseProps = {
  accountError: string | null;
  activeAccounts: AccountSummary[];
  categoryDecisions: Record<string, string>;
  categoryError: string | null;
  importError: string | null;
  importLoading: boolean;
  messageDecisions: Record<string, MessageSource>;
  openProviderDialog: () => void;
  parseResult: ParseResponse | null;
  providerDetection: ProviderDetection | null;
  resetImport: () => void;
  reviewCategoryOptions: Category[];
  selectedAccountId: string;
  setCategoryDecisions: Dispatch<SetStateAction<Record<string, string>>>;
  setMessageDecisions: Dispatch<SetStateAction<Record<string, MessageSource>>>;
  submitError: string | null;
  submitLoading: boolean;
  submitNotice: string | null;
  submitReviewRows: () => void;
};

function getReviewRows(parseResult: ParseResponse | null): ReviewRow[] {
  if (!parseResult?.review || !Array.isArray(parseResult.review.rows)) {
    return [];
  }
  return parseResult.review.rows;
}

export function ImportReviewPhase({
  accountError,
  activeAccounts,
  categoryDecisions,
  categoryError,
  importError,
  importLoading,
  messageDecisions,
  openProviderDialog,
  parseResult,
  providerDetection,
  resetImport,
  reviewCategoryOptions,
  selectedAccountId,
  setCategoryDecisions,
  setMessageDecisions,
  submitError,
  submitLoading,
  submitNotice,
  submitReviewRows,
}: ImportReviewPhaseProps) {
  const reviewRows = getReviewRows(parseResult);

  if (importLoading) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-1 items-center gap-2">
            <Loader2
              className="h-6 w-6 shrink-0 animate-spin text-muted-foreground"
              aria-hidden="true"
            />
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Import Preview
            </h2>
          </div>
        </div>

        <div className="flex flex-col gap-x-1.5 gap-y-1 border-b pb-4 text-sm text-muted-foreground">
          <div>
            <span>Importing to: </span>
            <span className="font-semibold text-foreground">
              {activeAccounts.find(
                (account) => account.id === selectedAccountId,
              )?.name ?? selectedAccountId}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Preparing parsed rows for review.
          </p>
          <ReviewTableSkeleton />
        </div>
      </div>
    );
  }

  if (!parseResult) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-1 items-center gap-2">
          <CheckCircle2
            className="h-6 w-6 shrink-0 text-emerald-600"
            aria-hidden="true"
          />
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Import Preview
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={resetImport}
            disabled={submitLoading}
            className="gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Start Over
          </Button>
          {parseResult.review ? (
            <Button
              size="sm"
              onClick={submitReviewRows}
              disabled={submitLoading}
              className="gap-1.5"
            >
              {submitLoading ? (
                <Loader2
                  className="h-3.5 w-3.5 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <DownloadCloud className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              Confirm Import
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-x-1.5 gap-y-1 border-b pb-4 text-sm text-muted-foreground">
        {providerDetection ? (
          <div>
            <span>Detected provider: </span>
            <span className="font-semibold text-foreground">
              {providerDetection.providerName ?? "Unknown"}
            </span>
            {providerDetection.state !== "certain" ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-5 gap-0.5 px-1 text-xs"
                onClick={openProviderDialog}
              >
                <Pencil className="h-3 w-3" aria-hidden="true" />
                Change
              </Button>
            ) : null}
            <span className="mx-1 text-border">·</span>
          </div>
        ) : null}
        <div>
          <span>Importing to: </span>
          <span className="font-semibold text-foreground">
            {activeAccounts.find((account) => account.id === selectedAccountId)
              ?.name ?? selectedAccountId}
          </span>
        </div>
      </div>

      {parseResult.review ? (
        <div className="grid grid-cols-3 divide-x overflow-hidden rounded-lg border">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-muted-foreground">Total Rows</span>
            <span className="text-sm font-bold">{reviewRows.length}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-muted-foreground">Credits</span>
            <span className="text-sm font-bold text-emerald-600">
              +
              {formatNok(
                reviewRows.reduce(
                  (sum, row) => (row.amountNok > 0 ? sum + row.amountNok : sum),
                  0,
                ),
              )}
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-muted-foreground">Debits</span>
            <span className="text-sm font-bold text-red-600">
              {formatNok(
                reviewRows.reduce(
                  (sum, row) => (row.amountNok < 0 ? sum + row.amountNok : sum),
                  0,
                ),
              )}
            </span>
          </div>
        </div>
      ) : null}

      {accountError ? (
        <p
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {accountError}
        </p>
      ) : null}
      {importError ? (
        <p
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {importError}
        </p>
      ) : null}
      {categoryError ? (
        <p
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {categoryError}
        </p>
      ) : null}

      {parseResult.errors.length > 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-800">
            Validation errors
          </p>
          <ul className="space-y-1 text-sm text-amber-700">
            {parseResult.errors.map((error) => (
              <li key={`${error.rowNumber}-${error.code}`}>
                Row {error.rowNumber}: {error.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {parseResult.review && reviewRows.length > 0 ? (
        <div className="space-y-2">
          {parseResult.review.potentialDuplicates > 0 ? (
            <p className="text-xs text-muted-foreground">
              {parseResult.review.potentialDuplicates} potential duplicate
              {parseResult.review.potentialDuplicates !== 1 ? "s" : ""}{" "}
              detected. Default message selection uses AI-cleaned text when
              available.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Default message selection uses AI-cleaned text when available.
              Rows without a suggestion keep the original message.
            </p>
          )}
          <ImportReviewTable
            rows={reviewRows}
            categories={reviewCategoryOptions}
            categoryDecisions={categoryDecisions}
            messageDecisions={messageDecisions}
            setCategoryDecisions={setCategoryDecisions}
            setMessageDecisions={setMessageDecisions}
          />
        </div>
      ) : null}

      {submitError ? (
        <p
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {submitError}
        </p>
      ) : null}
      {submitNotice ? (
        <output className="block rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {submitNotice}
        </output>
      ) : null}
    </div>
  );
}
