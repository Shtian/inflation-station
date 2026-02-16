"use client";

import { Check, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

type ParseResponse = {
  summary: ImportSummary;
  errors: ImportError[];
  review?: {
    sessionId: string | null;
    potentialDuplicates: number;
    rows: Array<{
      id: string;
      rowNumber: number;
      bookingDate: string;
      amountNok: number;
      currency: "NOK";
      normalizedMerchant: string;
      paymentType: string;
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

const UNCATEGORIZED_SELECT_VALUE = "__uncategorized__";

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
  const [categoryDecisions, setCategoryDecisions] = useState<
    Record<string, string>
  >({});

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

    const formData = new FormData();
    formData.set("accountId", selectedAccountId);
    formData.set("file", selectedFile);

    const response = await fetch("/api/imports/parse", {
      method: "POST",
      body: formData,
    });

    const body = await response.json().catch(() => null);

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

    setParseResult(body as ParseResponse);
    const reviewRows = Array.isArray((body as ParseResponse).review?.rows)
      ? (body as ParseResponse).review?.rows
      : [];
    setCategoryDecisions(
      reviewRows?.reduce<Record<string, string>>((acc, row) => {
        if (row.categoryId) {
          acc[row.id] = row.categoryId;
        }
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
    setSelectedFile(null);
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
            htmlFor="csv-file"
            className="text-sm font-medium text-foreground"
          >
            CSV file
          </label>
          <Input
            id="csv-file"
            type="file"
            accept=".csv,text/csv"
            key={
              selectedFile
                ? `${selectedFile.name}-${selectedFile.size}-${selectedFile.lastModified}`
                : "empty"
            }
            onChange={(event) =>
              setSelectedFile(event.target.files?.[0] ?? null)
            }
          />

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
                <div className="overflow-x-auto rounded-md border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Row</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Merchant</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Payment type</TableHead>
                        <TableHead>Warning</TableHead>
                        <TableHead>Category</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parseResult.review.rows.map((row) => {
                        const selectedCategoryId =
                          categoryDecisions[row.id] ?? row.categoryId ?? "";
                        const isUncategorized = selectedCategoryId.length === 0;
                        return (
                          <TableRow key={row.id}>
                            <TableCell>{row.rowNumber}</TableCell>
                            <TableCell>{row.bookingDate}</TableCell>
                            <TableCell>
                              {row.normalizedMerchant || "Unknown merchant"}
                            </TableCell>
                            <TableCell>{formatNok(row.amountNok)}</TableCell>
                            <TableCell>{row.paymentType}</TableCell>
                            <TableCell>
                              {row.potentialDuplicate ? (
                                <span className="font-medium text-amber-700">
                                  Potential duplicate
                                </span>
                              ) : (
                                <span className="text-muted-foreground">
                                  None
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <Select
                                  aria-label={`Category for row ${row.rowNumber}`}
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
                                  <SelectTrigger className="w-[220px]">
                                    <SelectValue placeholder="Uncategorized" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem
                                      value={UNCATEGORIZED_SELECT_VALUE}
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
                                {isUncategorized ? (
                                  <p className="text-xs font-medium text-muted-foreground">
                                    Uncategorized
                                  </p>
                                ) : null}
                              </div>
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
