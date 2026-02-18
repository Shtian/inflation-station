"use client";

import {
  CheckCircle2,
  DownloadCloud,
  FileText,
  Landmark,
  Loader2,
  Pencil,
  RotateCcw,
  UploadCloud,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { MessageSource, ReviewRow } from "./import-review-table";
import {
  ImportReviewTable,
  MESSAGE_SOURCE_CLEANED,
  MESSAGE_SOURCE_ORIGINAL,
  ReviewTableSkeleton,
} from "./import-review-table";

type Account = {
  id: string;
  name: string;
  institution: string | null;
  isActive: boolean;
};

type ImportSummary = {
  imported: number;
  duplicates: number;
  ignoredReserved: number;
  invalid: number;
};

type ImportError = {
  rowNumber: number;
  code: string;
  message: string;
};

type ProviderDetectionState = "certain" | "uncertain" | "missing";

type ProviderDetection = {
  state: ProviderDetectionState;
  providerId: string | null;
  providerName: string | null;
  score: number;
  matchedHeaders: string[];
  candidates: Array<{
    providerId: string;
    providerName: string;
    requiredMatches: number;
    requiredTotal: number;
    patternMatches: number;
    score: number;
  }>;
};

type ParseResponse = {
  detection: ProviderDetection;
  summary: ImportSummary;
  errors: ImportError[];
  review?: {
    sessionId: string | null;
    potentialDuplicates: number;
    messageCleanupUnavailableReason:
      | "disabled"
      | "key_missing"
      | "timeout"
      | "provider_error"
      | null;
    rows: ReviewRow[];
  };
};

type SubmitResponse = {
  summary: {
    imported: number;
    potentialDuplicates: number;
    invalid: number;
    skipped: number;
  };
};

type Category = {
  id: string;
  name: string;
  accountId: string | null;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatNok(value: number) {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

const AUTO_PROVIDER_SELECT_VALUE = "__auto_provider__";

function getRequestErrorMessage(body: unknown) {
  if (typeof body === "object" && body && "message" in body) {
    const value = (body as { message: unknown }).message;
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  if (typeof body === "object" && body && "error" in body) {
    const value = (body as { error: unknown }).error;
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  return "Request failed. Please try again.";
}

export function ImportUploader() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitNotice, setSubmitNotice] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParseResponse | null>(null);
  const [providerDetection, setProviderDetection] =
    useState<ProviderDetection | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState(
    AUTO_PROVIDER_SELECT_VALUE,
  );
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isProviderDialogOpen, setIsProviderDialogOpen] = useState(false);
  const [dialogSelectedProviderId, setDialogSelectedProviderId] = useState("");
  const [allProviders, setAllProviders] = useState<
    { id: string; name: string }[]
  >([]);
  const [categoryDecisions, setCategoryDecisions] = useState<
    Record<string, string>
  >({});
  const [messageDecisions, setMessageDecisions] = useState<
    Record<string, MessageSource>
  >({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadAccounts = useCallback(async () => {
    setAccountError(null);

    const response = await fetch("/api/accounts");
    const body = await response.json().catch(() => null);

    if (
      !response.ok ||
      !body ||
      typeof body !== "object" ||
      !("accounts" in body)
    ) {
      setAccountError("Could not load accounts.");
      setAccounts([]);
      return;
    }

    const nextAccounts = Array.isArray(body.accounts)
      ? (body.accounts as Account[])
      : [];
    setAccounts(nextAccounts);

    setSelectedAccountId((current) => {
      if (current && nextAccounts.some((account) => account.id === current)) {
        return current;
      }

      return nextAccounts[0]?.id ?? "";
    });
  }, []);

  const loadCategories = useCallback(async () => {
    setCategoryError(null);

    const response = await fetch("/api/categories");
    const body = await response.json().catch(() => null);

    if (
      !response.ok ||
      !body ||
      typeof body !== "object" ||
      !("categories" in body)
    ) {
      setCategoryError("Could not load categories for review.");
      setCategories([]);
      return;
    }

    setCategories(
      Array.isArray(body.categories) ? (body.categories as Category[]) : [],
    );
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: loadAllProviders loads every re-render
  useEffect(() => {
    void loadAccounts();
    void loadCategories();
    void loadAllProviders();
  }, [loadAccounts, loadCategories]);

  const activeAccounts = useMemo(
    () => accounts.filter((account) => account.isActive),
    [accounts],
  );
  const hasActiveAccounts = activeAccounts.length > 0;
  const reviewCategoryOptions = useMemo(
    () =>
      categories.filter(
        (category) =>
          category.accountId === null ||
          category.accountId === selectedAccountId,
      ),
    [categories, selectedAccountId],
  );
  const dialogProviderOptions = useMemo(() => {
    if (
      providerDetection?.candidates &&
      providerDetection.candidates.length > 0
    ) {
      return providerDetection.candidates.map((c) => ({
        id: c.providerId,
        name: c.providerName,
      }));
    }
    return allProviders;
  }, [providerDetection, allProviders]);

  async function loadAllProviders() {
    if (allProviders.length > 0) return;
    const response = await fetch("/api/import-provider-mappings");
    const body = await response.json().catch(() => null);
    if (
      body &&
      typeof body === "object" &&
      "mappings" in body &&
      Array.isArray(body.mappings)
    ) {
      setAllProviders(
        (body.mappings as Array<{ id: string; providerName: string }>).map(
          (m) => ({ id: m.id, name: m.providerName }),
        ),
      );
    }
  }

  function openProviderDialog() {
    const currentId =
      selectedProviderId !== AUTO_PROVIDER_SELECT_VALUE
        ? selectedProviderId
        : (providerDetection?.providerId ?? "");
    setDialogSelectedProviderId(currentId);
    if ((providerDetection?.candidates ?? []).length === 0) {
      void loadAllProviders();
    }
    setIsProviderDialogOpen(true);
  }

  function handleProviderConfirm() {
    if (!dialogSelectedProviderId) {
      setIsProviderDialogOpen(false);
      return;
    }
    const chosen = dialogProviderOptions.find(
      (p) => p.id === dialogSelectedProviderId,
    );
    if (chosen) {
      setSelectedProviderId(chosen.id);
      if (providerDetection) {
        setProviderDetection({
          ...providerDetection,
          state: "certain",
          providerId: chosen.id,
          providerName: chosen.name,
        });
      }
    }
    setIsProviderDialogOpen(false);
  }

  async function parseCsv() {
    if (!selectedAccountId) {
      setImportError("Select an account before parsing.");
      return;
    }

    if (!selectedFile) {
      setImportError("Choose a CSV file to parse.");
      return;
    }

    setImportLoading(true);
    setImportError(null);
    setSubmitError(null);
    setSubmitNotice(null);
    setParseResult(null);
    setCategoryDecisions({});
    setMessageDecisions({});

    const formData = new FormData();
    formData.set("accountId", selectedAccountId);
    formData.set("file", selectedFile);
    if (selectedProviderId !== AUTO_PROVIDER_SELECT_VALUE) {
      formData.set("providerId", selectedProviderId);
    }

    const response = await fetch("/api/imports/parse", {
      method: "POST",
      body: formData,
    });

    const body = await response.json().catch(() => null);

    if (
      response.status === 409 &&
      body &&
      typeof body === "object" &&
      "error" in body &&
      (body as { error: unknown }).error === "PROVIDER_SELECTION_REQUIRED"
    ) {
      const detection =
        "detection" in body
          ? ((body as { detection: ProviderDetection }).detection ?? null)
          : null;
      setProviderDetection(detection);
      setImportError(getRequestErrorMessage(body));
      setImportLoading(false);
      return;
    }

    if (
      !response.ok ||
      !body ||
      typeof body !== "object" ||
      !("summary" in body)
    ) {
      setImportError(getRequestErrorMessage(body));
      setImportLoading(false);
      return;
    }

    const parseResponse = body as ParseResponse;
    setParseResult(parseResponse);
    setProviderDetection(parseResponse.detection);
    if (parseResponse.detection.providerId) {
      setSelectedProviderId(parseResponse.detection.providerId);
    }

    const reviewRows = Array.isArray(parseResponse.review?.rows)
      ? parseResponse.review?.rows
      : [];
    setCategoryDecisions(
      reviewRows?.reduce<Record<string, string>>((acc, row) => {
        if (row.categoryId) {
          acc[row.id] = row.categoryId;
        }
        return acc;
      }, {}) ?? {},
    );
    setMessageDecisions(
      reviewRows?.reduce<Record<string, MessageSource>>((acc, row) => {
        acc[row.id] =
          typeof row.cleanedMessage === "string" &&
          row.cleanedMessage.length > 0
            ? MESSAGE_SOURCE_CLEANED
            : MESSAGE_SOURCE_ORIGINAL;
        return acc;
      }, {}) ?? {},
    );
    setImportLoading(false);
  }

  function resetImport() {
    setParseResult(null);
    setProviderDetection(null);
    setSelectedProviderId(AUTO_PROVIDER_SELECT_VALUE);
    setCategoryDecisions({});
    setMessageDecisions({});
    setImportError(null);
    setSubmitError(null);
    setSubmitNotice(null);
  }

  async function submitReviewRows() {
    if (!parseResult?.review?.sessionId) {
      setSubmitError("No review session is available to submit.");
      return;
    }

    setSubmitLoading(true);
    setSubmitError(null);
    setSubmitNotice(null);

    const response = await fetch("/api/imports/submit", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sessionId: parseResult.review.sessionId,
        invalidCount: parseResult.summary.invalid,
        rows: parseResult.review.rows.map((row) => ({
          selectedMessage:
            messageDecisions[row.id] === MESSAGE_SOURCE_CLEANED &&
            typeof row.cleanedMessage === "string" &&
            row.cleanedMessage.trim().length > 0
              ? row.cleanedMessage
              : row.title,
          rowId: row.id,
          categoryId: categoryDecisions[row.id] ?? row.categoryId,
        })),
      }),
    });
    const body = await response.json().catch(() => null);

    if (
      !response.ok ||
      !body ||
      typeof body !== "object" ||
      !("summary" in body)
    ) {
      setSubmitError(getRequestErrorMessage(body));
      setSubmitLoading(false);
      return;
    }

    const submitResult = body as SubmitResponse;
    setSubmitNotice(
      `Import complete. Imported ${submitResult.summary.imported}, skipped ${submitResult.summary.skipped}, potential duplicates ${submitResult.summary.potentialDuplicates}, invalid ${submitResult.summary.invalid}.`,
    );
    setParseResult(null);
    setCategoryDecisions({});
    setMessageDecisions({});
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setSubmitLoading(false);
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 md:px-10">
      <div className="mb-4 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Import
        </h1>
        <p className="text-sm text-muted-foreground">
          Choose an account and CSV file to start the parse and validation flow.
        </p>
      </div>

      <Separator className="my-4" />

      {importLoading ? (
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
                {activeAccounts.find((a) => a.id === selectedAccountId)?.name ??
                  selectedAccountId}
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
      ) : parseResult ? (
        // === REVIEW PHASE (Image 2 layout) ===
        <div className="space-y-4">
          {/* Header row */}
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

          {/* Provider + account info */}
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
                {activeAccounts.find((a) => a.id === selectedAccountId)?.name ??
                  selectedAccountId}
              </span>
            </div>
          </div>

          {/* Stats row */}
          {parseResult.review ? (
            <div className="grid grid-cols-3 divide-x overflow-hidden rounded-lg border">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-muted-foreground">
                  Total Rows
                </span>
                <span className="text-sm font-bold">
                  {parseResult.review.rows.length}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-muted-foreground">Credits</span>
                <span className="text-sm font-bold text-emerald-600">
                  +
                  {formatNok(
                    parseResult.review.rows.reduce(
                      (sum, r) => (r.amountNok > 0 ? sum + r.amountNok : sum),
                      0,
                    ),
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-muted-foreground">Debits</span>
                <span className="text-sm font-bold text-red-600">
                  {formatNok(
                    parseResult.review.rows.reduce(
                      (sum, r) => (r.amountNok < 0 ? sum + r.amountNok : sum),
                      0,
                    ),
                  )}
                </span>
              </div>
            </div>
          ) : null}

          {/* Errors */}
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

          {/* Parse validation errors */}
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

          {/* Review table */}
          {parseResult.review && parseResult.review.rows.length > 0 ? (
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
                rows={parseResult.review.rows}
                categories={reviewCategoryOptions}
                categoryDecisions={categoryDecisions}
                messageDecisions={messageDecisions}
                setCategoryDecisions={setCategoryDecisions}
                setMessageDecisions={setMessageDecisions}
              />
            </div>
          ) : null}

          {/* Submit error / notice */}
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
      ) : (
        // === UPLOAD PHASE (Image 1 layout) ===
        <div className="mx-auto max-w-lg space-y-4">
          {/* Import Configuration card */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-foreground">
                Import Configuration
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Select the target bank account and upload your CSV file to
                begin.
              </p>
            </div>

            <div className="space-y-5">
              {/* Bank Account */}
              <div className="space-y-1.5">
                <label
                  htmlFor="account-select"
                  className="text-sm font-medium text-foreground"
                >
                  Bank Account
                </label>
                <Select
                  value={selectedAccountId}
                  onValueChange={setSelectedAccountId}
                  disabled={!hasActiveAccounts}
                >
                  <SelectTrigger id="account-select" className="w-full">
                    <div className="flex items-center gap-2">
                      <Landmark
                        className="h-4 w-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <SelectValue
                        placeholder={
                          hasActiveAccounts
                            ? "Select a bank account"
                            : "No active accounts available"
                        }
                      />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {activeAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Choose the account this CSV data belongs to.
                </p>
              </div>

              <Separator />

              {/* CSV File */}
              <div className="space-y-1.5">
                <label
                  htmlFor="csv-file"
                  className="text-sm font-medium text-foreground"
                >
                  CSV File
                </label>

                {/* Hidden file input — always mounted so ref is always valid */}
                <input
                  name="csv-file"
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  aria-label="CSV file"
                  id="csv-file"
                  className="sr-only"
                  onChange={(event) => {
                    setSelectedFile(event.target.files?.[0] ?? null);
                    setParseResult(null);
                    setCategoryDecisions({});
                    setMessageDecisions({});
                    setProviderDetection(null);
                    setSelectedProviderId(AUTO_PROVIDER_SELECT_VALUE);
                    setImportError(null);
                  }}
                />

                {selectedFile ? (
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
                    <FileText className="shrink-0"></FileText>
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate text-foreground"
                        title={selectedFile.name}
                      >
                        {selectedFile.name}
                      </p>
                      <p className="text-muted-foreground">
                        {formatFileSize(selectedFile.size)}
                      </p>
                    </div>
                    <Button
                      variant={"ghost"}
                      aria-label="Clear selected file"
                      onClick={() => {
                        setSelectedFile(null);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = "";
                        }
                      }}
                      className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={cn(
                      "flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-10 text-center transition-colors",
                      isDraggingOver
                        ? "border-primary bg-primary/5"
                        : "border-muted-foreground/25 hover:border-muted-foreground/50",
                    )}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setIsDraggingOver(true);
                    }}
                    onDragLeave={() => setIsDraggingOver(false)}
                    onDrop={(event) => {
                      event.preventDefault();
                      setIsDraggingOver(false);
                      const file = event.dataTransfer.files?.[0];
                      if (!file) return;
                      if (
                        file.type !== "text/csv" &&
                        !file.name.endsWith(".csv")
                      )
                        return;
                      setSelectedFile(file);
                      setParseResult(null);
                      setCategoryDecisions({});
                      setMessageDecisions({});
                      setProviderDetection(null);
                      setSelectedProviderId(AUTO_PROVIDER_SELECT_VALUE);
                      setImportError(null);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="rounded-full bg-muted p-3">
                      <UploadCloud
                        className="h-6 w-6 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        Drag &amp; drop your CSV file
                      </p>
                      <p className="text-xs text-muted-foreground">
                        or click to browse from your computer
                      </p>
                    </div>
                    <span className="pointer-events-none inline-flex items-center rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background">
                      Browse Files
                    </span>
                    <p className="text-xs text-muted-foreground">
                      Supports .csv files up to 10MB
                    </p>
                  </button>
                )}
              </div>

              {/* Provider detection (shown after a parse error) */}
              {providerDetection ? (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Provider
                  </p>
                  <div className="flex items-center gap-2">
                    {providerDetection.state === "certain" ? (
                      <>
                        <Badge className="border-green-200 bg-green-100 text-green-800">
                          {providerDetection.providerName}
                        </Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 gap-1 text-xs"
                          onClick={openProviderDialog}
                        >
                          <Pencil className="h-3 w-3" aria-hidden="true" />
                          Change
                        </Button>
                      </>
                    ) : providerDetection.state === "uncertain" ? (
                      <>
                        <Badge className="border-amber-200 bg-amber-100 text-amber-800">
                          {providerDetection.providerName ?? "Unknown"}
                        </Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 gap-1 text-xs"
                          onClick={openProviderDialog}
                        >
                          <Pencil className="h-3 w-3" aria-hidden="true" />
                          Change
                        </Button>
                      </>
                    ) : (
                      <>
                        <Badge variant="destructive">
                          No provider detected
                        </Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 gap-1 text-xs"
                          onClick={openProviderDialog}
                        >
                          Select provider
                        </Button>
                      </>
                    )}
                  </div>
                  {providerDetection.state === "uncertain" ? (
                    <p className="text-xs text-muted-foreground">
                      Detection was uncertain — please confirm
                    </p>
                  ) : null}
                </div>
              ) : null}

              {/* Errors */}
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
            </div>

            {/* Parse & Preview CTA */}
            <Button
              onClick={parseCsv}
              disabled={!hasActiveAccounts || importLoading}
              variant="secondary"
              className="mt-6 w-full gap-2"
            >
              {importLoading ? (
                <>
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                  Parsing…
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" aria-hidden="true" />
                  Parse &amp; Preview
                </>
              )}
            </Button>
          </div>

          {/* Supported bank formats card */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="mb-2.5 text-sm font-medium text-foreground">
              Supported bank formats
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(allProviders.length > 0
                ? allProviders.slice(0, 5)
                : [
                    { id: "_chase", name: "Chase Bank" },
                    { id: "_boa", name: "Bank of America" },
                    { id: "_wells", name: "Wells Fargo" },
                    { id: "_citi", name: "Citi Bank" },
                  ]
              ).map((p) => (
                <Badge key={p.id} variant="outline">
                  {p.name}
                </Badge>
              ))}
              {allProviders.length > 5 ? (
                <Badge variant="outline">
                  + {allProviders.length - 5} more
                </Badge>
              ) : null}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              The parser automatically detects the bank based on the CSV column
              headers.
            </p>
          </div>

          {/* Success notice after completed import */}
          {submitNotice ? (
            <output className="block rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {submitNotice}
            </output>
          ) : null}
        </div>
      )}

      <Dialog
        open={isProviderDialogOpen}
        onOpenChange={setIsProviderDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select provider</DialogTitle>
            <DialogDescription>
              Choose the provider that matches your CSV file format.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {dialogProviderOptions.map((provider) => (
              <button
                key={provider.id}
                type="button"
                onClick={() => setDialogSelectedProviderId(provider.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent",
                  dialogSelectedProviderId === provider.id
                    ? "border-primary bg-primary/5"
                    : "border-border",
                )}
              >
                <div
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                    dialogSelectedProviderId === provider.id
                      ? "border-primary bg-primary"
                      : "border-muted-foreground",
                  )}
                >
                  {dialogSelectedProviderId === provider.id ? (
                    <div className="h-2 w-2 rounded-full bg-primary-foreground" />
                  ) : null}
                </div>
                <span className="text-sm font-medium">{provider.name}</span>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsProviderDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleProviderConfirm}
              disabled={!dialogSelectedProviderId}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
