import {
  CheckCircle2,
  DownloadCloud,
  Loader2,
  Pencil,
  RotateCcw,
} from "lucide-react";
import { type Dispatch, type SetStateAction, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Progress } from "@/components/ui/progress";
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

function getCleanupUnavailableMessage(
  reason: "disabled" | "key_missing" | "timeout" | "provider_error" | null,
) {
  if (reason === "disabled") {
    return "Message cleanup is disabled by configuration.";
  }

  if (reason === "key_missing") {
    return "Message cleanup unavailable: OPENAI_API_KEY is missing.";
  }

  if (reason === "timeout") {
    return "Message cleanup timed out. Original messages are kept for this import.";
  }

  if (reason === "provider_error") {
    return "Message cleanup provider failed. Original messages are kept for this import.";
  }

  return null;
}

type AccountSummary = {
  id: string;
  name: string;
};

type ImportReviewPhaseProps = {
  accountError: string | null;
  activeAccounts: AccountSummary[];
  categoryDecisions: Record<string, string>;
  noteDecisions: Record<string, string>;
  categoryError: string | null;
  importError: string | null;
  importLoading: boolean;
  messageDecisions: Record<string, MessageSource>;
  noteValidationErrors: Record<string, string>;
  openProviderDialog: () => void;
  parseResult: ParseResponse | null;
  providerDetection: ProviderDetection | null;
  resetImport: () => void;
  reviewCategoryOptions: Category[];
  selectedAccountId: string;
  setCategoryDecisions: Dispatch<SetStateAction<Record<string, string>>>;
  setNoteDecision: (rowId: string, note: string) => void;
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
  noteDecisions,
  categoryError,
  importError,
  importLoading,
  messageDecisions,
  noteValidationErrors,
  openProviderDialog,
  parseResult,
  providerDetection,
  resetImport,
  reviewCategoryOptions,
  selectedAccountId,
  setCategoryDecisions,
  setNoteDecision,
  setMessageDecisions,
  submitError,
  submitLoading,
  submitNotice,
  submitReviewRows,
}: ImportReviewPhaseProps) {
  const [loadingProgress, setLoadingProgress] = useState(8);

  useEffect(() => {
    if (!importLoading) {
      setLoadingProgress(8);
      return;
    }

    const intervalId = setInterval(() => {
      setLoadingProgress((current) => {
        if (current >= 92) {
          return current;
        }

        return Math.min(92, current + (current < 50 ? 8 : 4));
      });
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [importLoading]);

  const reviewRows = getReviewRows(parseResult);
  const cleanedSuggestionCount = reviewRows.reduce(
    (count, row) =>
      typeof row.cleanedMessage === "string" && row.cleanedMessage.length > 0
        ? count + 1
        : count,
    0,
  );
  const cleanupUnavailableMessage = getCleanupUnavailableMessage(
    parseResult?.review?.messageCleanupUnavailableReason ?? null,
  );

  if (importLoading) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-1 items-center gap-2">
            <Loader2
              className="h-6 w-6 shrink-0 animate-spin text-muted-foreground"
              aria-hidden="true"
            />
            <h2 className="font-semibold text-foreground text-xl tracking-tight">
              Import Preview
            </h2>
          </div>
        </div>

        <div className="flex flex-col gap-x-1.5 gap-y-1 border-b pb-4 text-muted-foreground text-sm">
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
          <p className="text-muted-foreground text-xs">
            Waiting for AI feedback. This can take up to 90 seconds.
          </p>
          <Field className="w-full">
            <FieldLabel htmlFor="import-ai-feedback-progress">
              <span>AI feedback progress</span>
              <span className="ml-auto">{loadingProgress}%</span>
            </FieldLabel>
            <Progress
              value={loadingProgress}
              id="import-ai-feedback-progress"
            />
          </Field>
          <p className="text-muted-foreground text-xs">
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
          <h2 className="font-semibold text-foreground text-xl tracking-tight">
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

      <div className="flex flex-col gap-x-1.5 gap-y-1 border-b pb-4 text-muted-foreground text-sm">
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
            <span className="text-muted-foreground text-sm">Total Rows</span>
            <span className="font-bold text-sm">{reviewRows.length}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-muted-foreground text-sm">Credits</span>
            <span className="font-bold text-emerald-600 text-sm">
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
            <span className="text-muted-foreground text-sm">Debits</span>
            <span className="font-bold text-red-600 text-sm">
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
          className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-red-700 text-sm"
        >
          {accountError}
        </p>
      ) : null}
      {importError ? (
        <p
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-red-700 text-sm"
        >
          {importError}
        </p>
      ) : null}
      {categoryError ? (
        <p
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-red-700 text-sm"
        >
          {categoryError}
        </p>
      ) : null}

      {parseResult.errors.length > 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="mb-1 font-semibold text-amber-800 text-xs uppercase tracking-wide">
            Validation errors
          </p>
          <ul className="space-y-1 text-amber-700 text-sm">
            {parseResult.errors.map((error) => (
              <li key={`${error.rowNumber}-${error.code}`}>
                Row {error.rowNumber}: {error.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {cleanupUnavailableMessage ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 text-sm">
          {cleanupUnavailableMessage}
        </p>
      ) : null}

      {parseResult.review && reviewRows.length > 0 ? (
        <div className="space-y-2">
          {parseResult.review.potentialDuplicates > 0 ? (
            <p className="text-muted-foreground text-xs">
              {parseResult.review.potentialDuplicates} potential duplicate
              {parseResult.review.potentialDuplicates !== 1 ? "s" : ""}{" "}
              detected. Default message selection uses AI-cleaned text when
              available.
            </p>
          ) : (
            <p className="text-muted-foreground text-xs">
              Default message selection uses AI-cleaned text when available.
              Rows without a suggestion keep the original message.
            </p>
          )}
          <p className="text-muted-foreground text-xs">
            AI cleanup suggestions: {cleanedSuggestionCount} of{" "}
            {reviewRows.length}.
          </p>
          <ImportReviewTable
            rows={reviewRows}
            categories={reviewCategoryOptions}
            categoryDecisions={categoryDecisions}
            noteDecisions={noteDecisions}
            noteValidationErrors={noteValidationErrors}
            messageDecisions={messageDecisions}
            setCategoryDecisions={setCategoryDecisions}
            setNoteDecision={setNoteDecision}
            setMessageDecisions={setMessageDecisions}
          />
        </div>
      ) : null}

      {submitError ? (
        <p
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-red-700 text-sm"
        >
          {submitError}
        </p>
      ) : null}
      {submitNotice ? (
        <output className="block rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-emerald-800 text-sm">
          {submitNotice}
        </output>
      ) : null}
    </div>
  );
}
