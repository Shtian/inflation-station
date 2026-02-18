"use client";

import {
  Check,
  Sparkles,
  TriangleAlert,
  Upload,
  UploadCloud,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

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
    rows: Array<{
      id: string;
      rowNumber: number;
      bookingDate: string;
      amountNok: number;
      currency: "NOK";
      normalizedMerchant: string;
      paymentType: string;
      name?: string;
      title?: string;
      cleanedMessage?: string | null;
      categoryId: string | null;
      potentialDuplicate: boolean;
    }>;
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

const UNCATEGORIZED_SELECT_VALUE = "__uncategorized__";
const AUTO_PROVIDER_SELECT_VALUE = "__auto_provider__";
const MESSAGE_SOURCE_ORIGINAL = "original";
const MESSAGE_SOURCE_CLEANED = "cleaned";

type MessageSource =
  | typeof MESSAGE_SOURCE_ORIGINAL
  | typeof MESSAGE_SOURCE_CLEANED;

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

function formatNok(value: number) {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
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
  const providerOptions = useMemo(() => {
    const options = new Map<string, string>();

    for (const candidate of providerDetection?.candidates ?? []) {
      options.set(candidate.providerId, candidate.providerName);
    }

    if (providerDetection?.providerId && providerDetection.providerName) {
      options.set(providerDetection.providerId, providerDetection.providerName);
    }

    return [...options.entries()].map(([id, name]) => ({ id, name }));
  }, [providerDetection]);

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

          <label
            htmlFor="provider-select"
            className="text-sm font-medium text-foreground"
          >
            Provider
          </label>
          <Select
            value={selectedProviderId}
            onValueChange={setSelectedProviderId}
          >
            <SelectTrigger id="provider-select" className="w-full">
              <SelectValue placeholder="Auto-detect provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={AUTO_PROVIDER_SELECT_VALUE}>
                Auto-detect provider
              </SelectItem>
              {providerOptions.map((provider) => (
                <SelectItem key={provider.id} value={provider.id}>
                  {provider.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {providerDetection ? (
            <p className="text-xs text-muted-foreground">
              Provider detection: {providerDetection.state}
              {providerDetection.providerName
                ? ` (${providerDetection.providerName})`
                : ""}
              .
            </p>
          ) : null}

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

          <Button
            onClick={parseCsv}
            disabled={!hasActiveAccounts || importLoading}
            className="gap-2"
          >
            {importLoading ? (
              "Parsing..."
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
                <div className="overflow-x-auto rounded-md border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Message</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Payment type</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <TriangleAlert
                                  className="h-4 w-4 text-muted-foreground"
                                  aria-label="Warnings"
                                />
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                Potential duplicates or other import warnings
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parseResult.review.rows.map((row) => {
                        const originalMessage =
                          typeof row.title === "string" &&
                          row.title.trim().length > 0
                            ? row.title
                            : typeof row.name === "string" &&
                                row.name.trim().length > 0
                              ? row.name
                              : "No original message";
                        const hasCleanedMessage =
                          typeof row.cleanedMessage === "string" &&
                          row.cleanedMessage.trim().length > 0;
                        const selectedMessageSource =
                          messageDecisions[row.id] ??
                          (hasCleanedMessage
                            ? MESSAGE_SOURCE_CLEANED
                            : MESSAGE_SOURCE_ORIGINAL);
                        const selectedCategoryId =
                          categoryDecisions[row.id] ?? row.categoryId ?? "";
                        const isUncategorized = selectedCategoryId.length === 0;
                        return (
                          <TableRow key={row.id}>
                            <TableCell>{row.bookingDate}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="text-sm">
                                  {selectedMessageSource ===
                                  MESSAGE_SOURCE_CLEANED
                                    ? row.cleanedMessage
                                    : originalMessage}
                                </span>
                                {hasCleanedMessage ? (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          type="button"
                                          aria-label={`Toggle message source for row ${row.rowNumber}`}
                                          onClick={() =>
                                            setMessageDecisions((current) => ({
                                              ...current,
                                              [row.id]:
                                                selectedMessageSource ===
                                                MESSAGE_SOURCE_CLEANED
                                                  ? MESSAGE_SOURCE_ORIGINAL
                                                  : MESSAGE_SOURCE_CLEANED,
                                            }))
                                          }
                                          className={cn(
                                            "shrink-0 rounded p-0.5 transition-colors hover:bg-accent",
                                            selectedMessageSource ===
                                              MESSAGE_SOURCE_CLEANED
                                              ? "text-violet-500"
                                              : "text-muted-foreground",
                                          )}
                                        >
                                          <Sparkles
                                            className="h-3.5 w-3.5"
                                            aria-hidden="true"
                                          />
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent
                                        side="top"
                                        className="max-w-xs space-y-1 p-3 text-xs"
                                      >
                                        <p>
                                          <span className="font-medium">
                                            Original:
                                          </span>{" "}
                                          {originalMessage}
                                        </p>
                                        <p>
                                          <span className="font-medium">
                                            AI-cleaned:
                                          </span>{" "}
                                          {row.cleanedMessage}
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell>{formatNok(row.amountNok)}</TableCell>
                            <TableCell>{row.paymentType}</TableCell>
                            <TableCell>
                              <Select
                                value={
                                  selectedCategoryId ||
                                  UNCATEGORIZED_SELECT_VALUE
                                }
                                onValueChange={(value) =>
                                  setCategoryDecisions((current) => ({
                                    ...current,
                                    [row.id]:
                                      value === UNCATEGORIZED_SELECT_VALUE
                                        ? ""
                                        : value,
                                  }))
                                }
                              >
                                <SelectTrigger
                                  aria-label={`Category for row ${row.rowNumber}`}
                                  className={cn(
                                    "w-[220px]",
                                    isUncategorized && "text-amber-500",
                                  )}
                                >
                                  <SelectValue placeholder="Uncategorized" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem
                                    value={UNCATEGORIZED_SELECT_VALUE}
                                    className="text-amber-500"
                                  >
                                    Uncategorized
                                  </SelectItem>
                                  {reviewCategoryOptions.map((category) => (
                                    <SelectItem
                                      key={category.id}
                                      value={category.id}
                                    >
                                      {category.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              {row.potentialDuplicate ? (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <TriangleAlert
                                        className="h-4 w-4 text-amber-500"
                                        aria-label="Potential duplicate"
                                      />
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                      Potential duplicate
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ) : null}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <Button
                  onClick={submitReviewRows}
                  disabled={submitLoading}
                  className="gap-2"
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
              </div>
            ) : null}
          </section>
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
    </main>
  );
}
