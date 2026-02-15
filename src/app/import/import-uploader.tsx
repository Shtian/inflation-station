"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

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
};

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
  const [accountError, setAccountError] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParseResponse | null>(null);

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

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  const activeAccounts = useMemo(
    () => accounts.filter((account) => account.isActive),
    [accounts],
  );
  const hasActiveAccounts = activeAccounts.length > 0;

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
    setParseResult(null);

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
    setImportLoading(false);
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 md:px-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Import</h1>
        <p className="text-sm text-zinc-600">
          Upload a CSV to parse and validate rows before review.
        </p>
      </header>

      <Card className="mt-6">
        <div className="space-y-1">
          <CardTitle>CSV Upload</CardTitle>
          <CardDescription>
            Choose an account and CSV file to start the parse and validation
            flow.
          </CardDescription>
        </div>

        <div className="mt-4 grid gap-3">
          <label
            htmlFor="account-select"
            className="text-sm font-medium text-zinc-800"
          >
            Account
          </label>
          <Select
            id="account-select"
            value={selectedAccountId}
            onChange={(event) => setSelectedAccountId(event.target.value)}
            disabled={!hasActiveAccounts}
          >
            {!hasActiveAccounts ? (
              <option value="">No active accounts available</option>
            ) : null}
            {activeAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </Select>

          <label
            htmlFor="csv-file"
            className="text-sm font-medium text-zinc-800"
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
            onClick={parseCsv}
            disabled={!hasActiveAccounts || importLoading}
          >
            {importLoading ? "Parsing..." : "Parse CSV"}
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

        {parseResult ? (
          <section
            aria-live="polite"
            className="mt-4 space-y-4 rounded-md border border-zinc-200 bg-zinc-50 p-4"
          >
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-700">
              Parse summary
            </h2>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-zinc-600">Imported</dt>
                <dd className="font-semibold">
                  {parseResult.summary.imported}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-600">Duplicates</dt>
                <dd className="font-semibold">
                  {parseResult.summary.duplicates}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-600">Ignored reserved</dt>
                <dd className="font-semibold">
                  {parseResult.summary.ignoredReserved}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-600">Invalid</dt>
                <dd className="font-semibold">{parseResult.summary.invalid}</dd>
              </div>
            </dl>

            {parseResult.errors.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-700">
                  Validation errors
                </h3>
                <ul className="space-y-1 text-sm text-zinc-700">
                  {parseResult.errors.map((error) => (
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
    </main>
  );
}
