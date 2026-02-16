"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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

type ImportResponse = {
  summary: ImportSummary;
  errors: ImportError[];
};

type Category = {
  id: string;
  name: string;
  kind: string;
  accountId: string | null;
};

type ReviewItem = {
  transaction: {
    id: string;
    bookingDate: string;
    amountNok: number;
    normalizedMerchant: string;
    paymentType: string;
  };
  suggestion: {
    id: string;
    source: string;
    confidence: number | null;
    reasoning: string | null;
    category: {
      id: string;
      name: string;
    };
  };
};

function getRequestErrorMessage(body: unknown) {
  if (typeof body === "object" && body && "error" in body) {
    const value = (body as { error: unknown }).error;
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  return "Request failed. Please try again.";
}

function getReviewErrorMessage(status: number, body: unknown) {
  if (typeof body === "object" && body && "error" in body) {
    const code = String((body as { error: unknown }).error);

    if (status === 400 && code === "CATEGORY_NOT_FOUND") {
      return "One or more selected categories no longer exist. Refresh and try again.";
    }

    if (status === 400 && code === "INVALID_REVIEW_SUBMIT_PAYLOAD") {
      return "Invalid review submission. Please verify selected categories.";
    }
  }

  return "Could not submit review decisions.";
}

function formatNok(value: number) {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function buildInitialDecisions(items: ReviewItem[]) {
  return items.reduce<Record<string, string>>((acc, item) => {
    acc[item.transaction.id] = item.suggestion.category.id;
    return acc;
  }, {});
}

export default function Home() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountError, setAccountError] = useState<string | null>(null);

  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResponse | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [reviewLoading, setReviewLoading] = useState(true);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewNotice, setReviewNotice] = useState<string | null>(null);
  const [decisionsByTransactionId, setDecisionsByTransactionId] = useState<
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

  const loadReviewData = useCallback(async () => {
    setReviewLoading(true);
    setReviewError(null);

    const [categoriesResponse, reviewResponse] = await Promise.all([
      fetch("/api/categories"),
      fetch("/api/categorization/review"),
    ]);

    const categoriesBody = await categoriesResponse.json().catch(() => null);
    const reviewBody = await reviewResponse.json().catch(() => null);

    if (
      !categoriesResponse.ok ||
      !categoriesBody ||
      typeof categoriesBody !== "object" ||
      !("categories" in categoriesBody)
    ) {
      setReviewError("Could not load categories for review.");
      setCategories([]);
      setReviewItems([]);
      setDecisionsByTransactionId({});
      setReviewLoading(false);
      return;
    }

    if (
      !reviewResponse.ok ||
      !reviewBody ||
      typeof reviewBody !== "object" ||
      !("items" in reviewBody)
    ) {
      setReviewError("Could not load pending category reviews.");
      setCategories(
        Array.isArray(categoriesBody.categories)
          ? (categoriesBody.categories as Category[])
          : [],
      );
      setReviewItems([]);
      setDecisionsByTransactionId({});
      setReviewLoading(false);
      return;
    }

    const nextCategories = Array.isArray(categoriesBody.categories)
      ? (categoriesBody.categories as Category[])
      : [];
    const nextReviewItems = Array.isArray(reviewBody.items)
      ? (reviewBody.items as ReviewItem[])
      : [];

    setCategories(nextCategories);
    setReviewItems(nextReviewItems);
    setDecisionsByTransactionId(buildInitialDecisions(nextReviewItems));
    setReviewLoading(false);
  }, []);

  useEffect(() => {
    void loadAccounts();
    void loadReviewData();
  }, [loadAccounts, loadReviewData]);

  async function importCsv() {
    if (!selectedAccountId) {
      setImportError("Select an account before importing.");
      return;
    }

    if (!selectedFile) {
      setImportError("Choose a CSV file to import.");
      return;
    }

    setImportLoading(true);
    setImportError(null);

    const formData = new FormData();
    formData.set("accountId", selectedAccountId);
    formData.set("file", selectedFile);

    const response = await fetch("/api/imports", {
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
      setImportResult(null);
      setImportLoading(false);
      return;
    }

    setImportResult(body as ImportResponse);
    setImportLoading(false);
  }

  function changeDecision(transactionId: string, categoryId: string) {
    setDecisionsByTransactionId((current) => ({
      ...current,
      [transactionId]: categoryId,
    }));
  }

  function bulkAcceptSuggested() {
    setDecisionsByTransactionId(buildInitialDecisions(reviewItems));
    setReviewNotice("Applied suggested categories to all pending rows.");
    setReviewError(null);
  }

  async function submitReview() {
    if (reviewItems.length === 0) {
      return;
    }

    const decisions = reviewItems
      .map((item) => ({
        transactionId: item.transaction.id,
        categoryId:
          decisionsByTransactionId[item.transaction.id] ??
          item.suggestion.category.id,
      }))
      .filter((item) => item.categoryId);

    if (decisions.length === 0) {
      setReviewError("Choose a category for at least one row.");
      return;
    }

    setReviewSubmitting(true);
    setReviewError(null);
    setReviewNotice(null);

    const response = await fetch("/api/categorization/review", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ decisions }),
    });

    const body = await response.json().catch(() => null);

    if (!response.ok || !body || typeof body !== "object") {
      setReviewError(getReviewErrorMessage(response.status, body));
      setReviewSubmitting(false);
      return;
    }

    const updated =
      "updated" in body && typeof body.updated === "number" ? body.updated : 0;
    const skipped =
      "skipped" in body && typeof body.skipped === "number" ? body.skipped : 0;

    setReviewNotice(
      `Submitted review decisions. Updated ${updated}, skipped ${skipped}.`,
    );
    setReviewSubmitting(false);
    await loadReviewData();
  }

  const hasAccounts = accounts.length > 0;
  const activeAccounts = useMemo(
    () => accounts.filter((account) => account.isActive),
    [accounts],
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted px-5 py-8 text-foreground md:px-10">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Inflation Station
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Imports and Review
          </h1>
          <p className="text-sm text-muted-foreground">
            Upload transactions and finalize category decisions.
          </p>
        </header>

        <div className="grid gap-6">
          <Card>
            <div className="space-y-1">
              <CardTitle>CSV Upload</CardTitle>
              <CardDescription>
                Upload transactions for one selected account.
              </CardDescription>
            </div>

            <div className="mt-4 grid gap-3">
              <label
                htmlFor="account-select"
                className="text-sm font-medium text-foreground"
              >
                Account
              </label>
              <Select
                id="account-select"
                value={selectedAccountId}
                onChange={(event) => setSelectedAccountId(event.target.value)}
                disabled={!hasAccounts}
              >
                {!hasAccounts ? (
                  <option value="">No accounts available</option>
                ) : null}
                {activeAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
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
                onChange={(event) =>
                  setSelectedFile(event.target.files?.[0] ?? null)
                }
              />

              <Button
                onClick={importCsv}
                disabled={!hasAccounts || importLoading}
              >
                {importLoading ? "Importing..." : "Import transactions"}
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

            {importResult ? (
              <section
                aria-live="polite"
                className="mt-4 space-y-4 rounded-md border border-border bg-card p-4"
              >
                <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">
                  Import summary
                </h2>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Imported</dt>
                    <dd className="font-semibold">
                      {importResult.summary.imported}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Duplicates</dt>
                    <dd className="font-semibold">
                      {importResult.summary.duplicates}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Ignored reserved</dt>
                    <dd className="font-semibold">
                      {importResult.summary.ignoredReserved}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Invalid</dt>
                    <dd className="font-semibold">
                      {importResult.summary.invalid}
                    </dd>
                  </div>
                </dl>

                {importResult.errors.length > 0 ? (
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                      Validation errors
                    </h3>
                    <ul className="space-y-1 text-sm text-foreground">
                      {importResult.errors.map((error) => (
                        <li key={`${error.rowNumber}-${error.code}`}>
                          Row {error.rowNumber}: {error.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>
            ) : null}
          </Card>
        </div>

        <Card>
          <div className="space-y-1">
            <CardTitle>Category Review</CardTitle>
            <CardDescription>
              Review suggested categories, edit final categories, and submit in
              bulk.
            </CardDescription>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={bulkAcceptSuggested}
              disabled={
                reviewLoading || reviewItems.length === 0 || reviewSubmitting
              }
            >
              Use suggested for all
            </Button>
            <Button
              onClick={submitReview}
              disabled={
                reviewLoading || reviewItems.length === 0 || reviewSubmitting
              }
            >
              {reviewSubmitting ? "Submitting..." : "Submit review decisions"}
            </Button>
          </div>

          {reviewError ? (
            <p
              role="alert"
              className="mt-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {reviewError}
            </p>
          ) : null}

          {reviewNotice ? (
            <p className="mt-4 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {reviewNotice}
            </p>
          ) : null}

          <div className="mt-4 overflow-x-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Merchant</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Suggested</TableHead>
                  <TableHead>Final category</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviewLoading ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      Loading pending reviews...
                    </TableCell>
                  </TableRow>
                ) : null}
                {!reviewLoading && reviewItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5}>No pending suggestions.</TableCell>
                  </TableRow>
                ) : null}
                {!reviewLoading
                  ? reviewItems.map((item) => (
                      <TableRow key={item.suggestion.id}>
                        <TableCell>{item.transaction.bookingDate}</TableCell>
                        <TableCell>
                          {item.transaction.normalizedMerchant}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNok(item.transaction.amountNok)}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-foreground">
                            {item.suggestion.category.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {item.suggestion.source}
                            {typeof item.suggestion.confidence === "number"
                              ? ` (${Math.round(item.suggestion.confidence * 100)}%)`
                              : ""}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select
                            aria-label={`Final category for ${item.transaction.normalizedMerchant}`}
                            value={
                              decisionsByTransactionId[item.transaction.id] ??
                              item.suggestion.category.id
                            }
                            onChange={(event) =>
                              changeDecision(
                                item.transaction.id,
                                event.target.value,
                              )
                            }
                            disabled={
                              reviewSubmitting || categories.length === 0
                            }
                          >
                            {categories.length === 0 ? (
                              <option value="">No categories available</option>
                            ) : null}
                            {categories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))
                  : null}
              </TableBody>
            </Table>
          </div>
        </Card>
      </main>
    </div>
  );
}
