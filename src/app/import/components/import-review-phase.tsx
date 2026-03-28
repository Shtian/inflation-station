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
import { formatNok } from "@/lib/format-nok";
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
  selectedRowIds: Set<string>;
  setCategoryDecisions: Dispatch<SetStateAction<Record<string, string>>>;
  setNoteDecision: (rowId: string, note: string) => void;
  setMessageDecisions: Dispatch<SetStateAction<Record<string, MessageSource>>>;
  submitError: string | null;
  submitLoading: boolean;
  submitReviewRows: () => void;
  toggleAllRows: (rowIds: string[]) => void;
  toggleRowSelection: (rowId: string) => void;
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
  selectedRowIds,
  setCategoryDecisions,
  setNoteDecision,
  setMessageDecisions,
  submitError,
  submitLoading,
  submitReviewRows,
  toggleAllRows,
  toggleRowSelection,
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
            className="h-6 w-6 shrink-0 text-success"
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
            Start over
          </Button>
          {parseResult.review ? (
            <Button
              size="sm"
              onClick={submitReviewRows}
              disabled={submitLoading || selectedRowIds.size === 0}
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
              Import {selectedRowIds.size} / {reviewRows.length}
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
            <span className="font-bold font-mono text-sm">
              {reviewRows.length}
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-muted-foreground text-sm">Credits</span>
            <span className="font-bold font-mono text-sm text-success">
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
            <span className="font-bold font-mono text-destructive text-sm">
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
          className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-destructive text-sm"
        >
          {accountError}
        </p>
      ) : null}
      {importError ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-destructive text-sm"
        >
          {importError}
        </p>
      ) : null}
      {categoryError ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-destructive text-sm"
        >
          {categoryError}
        </p>
      ) : null}

      {parseResult.errors.length > 0 ? (
        <div className="rounded-md border border-warning/20 bg-warning/10 px-3 py-2">
          <p className="mb-1 font-semibold text-warning text-xs uppercase tracking-wide">
            Validation errors
          </p>
          <ul className="space-y-1 text-sm text-warning">
            {parseResult.errors.map((error) => (
              <li key={`${error.rowNumber}-${error.code}`}>
                Row {error.rowNumber}: {error.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {cleanupUnavailableMessage ? (
        <p className="rounded-md border border-warning/20 bg-warning/10 px-3 py-2 text-sm text-warning">
          {cleanupUnavailableMessage}
        </p>
      ) : null}

      {parseResult.review && reviewRows.length > 0 ? (
        <div className="space-y-2">
          {selectedRowIds.size === 0 ? (
            <p
              role="alert"
              className="rounded-md border border-warning/20 bg-warning/10 px-3 py-2 text-sm text-warning"
            >
              No rows selected — nothing will be imported. Select at least one
              row to continue.
            </p>
          ) : null}
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
            selectedRowIds={selectedRowIds}
            setCategoryDecisions={setCategoryDecisions}
            setNoteDecision={setNoteDecision}
            setMessageDecisions={setMessageDecisions}
            toggleAllRows={toggleAllRows}
            toggleRowSelection={toggleRowSelection}
          />
        </div>
      ) : null}

      {submitError ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-destructive text-sm"
        >
          {submitError}
        </p>
      ) : null}
    </div>
  );
}
