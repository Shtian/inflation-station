"use client";

import { Check, Loader2, Pencil, Upload, UploadCloud, X } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
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

  useEffect(() => {
    void loadAccounts();
    void loadCategories();
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
      <div className="space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Import
          </h1>
          <p className="text-sm text-muted-foreground">
            Choose an account and CSV file to start the parse and validation
            flow.
          </p>
        </div>

        <Separator className="my-4" />

        <div className="mt-4 grid gap-3">
          <label
            htmlFor="account-select"
            className="text-sm font-medium text-foreground"
          >
            Account
          </label>
          <Select
            value={selectedAccountId}
            onValueChange={setSelectedAccountId}
            disabled={!hasActiveAccounts}
          >
            <SelectTrigger id="account-select" className="w-full">
              <SelectValue
                placeholder={
                  hasActiveAccounts
                    ? "Select account"
                    : "No active accounts available"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {activeAccounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <button
            type="button"
            className={cn(
              "flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors",
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
              if (file.type !== "text/csv" && !file.name.endsWith(".csv"))
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
            <UploadCloud
              className="h-8 w-8 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="text-sm text-muted-foreground">
              Drag &amp; drop your CSV here, or click to browse
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              aria-label="CSV file"
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
          </button>
          {selectedFile ? (
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
              <span className="flex-1 truncate text-foreground">
                {selectedFile.name}
              </span>
              <span className="shrink-0 text-muted-foreground">
                {formatFileSize(selectedFile.size)}
              </span>
              <button
                type="button"
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
              </button>
            </div>
          ) : null}

          {providerDetection ? (
            <div className="space-y-1">
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
                      className="gap-1 text-xs"
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
                      className="gap-1 text-xs"
                      onClick={openProviderDialog}
                    >
                      <Pencil className="h-3 w-3" aria-hidden="true" />
                      Change
                    </Button>
                  </>
                ) : (
                  <>
                    <Badge variant="destructive">No provider detected</Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-1 text-xs"
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

          <Button
            onClick={parseCsv}
            disabled={!hasActiveAccounts || importLoading}
            className="gap-2"
          >
            {importLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Parsing…
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" aria-hidden="true" />
                Parse CSV
              </>
            )}
          </Button>
        </div>

        {accountError ? (
          <p
            role="alert"
            className="mt-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {accountError}
          </p>
        ) : null}

        {importError ? (
          <p
            role="alert"
            className="mt-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {importError}
          </p>
        ) : null}

        {categoryError ? (
          <p
            role="alert"
            className="mt-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {categoryError}
          </p>
        ) : null}

        {importLoading ? (
          <section aria-busy="true" className="mt-4 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">
              Parse summary
            </h2>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              {(
                [
                  "imported",
                  "duplicates",
                  "ignoredReserved",
                  "invalid",
                ] as const
              ).map((field) => (
                <div key={field}>
                  <Skeleton className="mb-1 h-4 w-24" />
                  <Skeleton className="h-5 w-16" />
                </div>
              ))}
            </dl>
            <ReviewTableSkeleton />
          </section>
        ) : null}

        {parseResult ? (
          <section aria-live="polite" className="mt-4 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">
              Parse summary
            </h2>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Imported</dt>
                <dd className="font-semibold">
                  {parseResult.summary.imported}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Duplicates</dt>
                <dd className="font-semibold">
                  {parseResult.summary.duplicates}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Ignored reserved</dt>
                <dd className="font-semibold">
                  {parseResult.summary.ignoredReserved}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Invalid</dt>
                <dd className="font-semibold">{parseResult.summary.invalid}</dd>
              </div>
            </dl>

            {parseResult.errors.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                  Validation errors
                </h3>
                <ul className="space-y-1 text-sm text-foreground">
                  {parseResult.errors.map((error) => (
                    <li key={`${error.rowNumber}-${error.code}`}>
                      Row {error.rowNumber}: {error.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {parseResult.review && parseResult.review.rows.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                  Review rows
                </h3>
                <p className="text-sm text-foreground">
                  Potential duplicates:{" "}
                  <span className="font-semibold">
                    {parseResult.review.potentialDuplicates}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Default message selection uses AI-cleaned text when available.
                  Rows without a suggestion keep the original message.
                </p>
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
          </section>
        ) : null}

        {parseResult?.review ? (
          <Button
            onClick={submitReviewRows}
            disabled={submitLoading}
            className="mt-4 gap-2"
          >
            {submitLoading ? (
              "Submitting..."
            ) : (
              <>
                <Check className="h-4 w-4" aria-hidden="true" />
                Submit reviewed rows
              </>
            )}
          </Button>
        ) : null}

        {submitError ? (
          <p
            role="alert"
            className="mt-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {submitError}
          </p>
        ) : null}

        {submitNotice ? (
          <output className="mt-4 block rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {submitNotice}
          </output>
        ) : null}
      </div>

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
