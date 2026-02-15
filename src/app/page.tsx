"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead } from "@/components/ui/table";

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

function getErrorMessage(status: number, body: unknown) {
  if (typeof body === "object" && body && "error" in body) {
    const code = String((body as { error: unknown }).error);
    if (status === 409 && code === "ACCOUNT_HAS_TRANSACTIONS") {
      return "Cannot delete account with imported transactions.";
    }

    if (status === 409 && code === "ACCOUNT_NAME_MUST_BE_UNIQUE") {
      return "An account with this name already exists.";
    }

    if (status === 404 && code === "ACCOUNT_NOT_FOUND") {
      return "Selected account was not found.";
    }
  }

  return "Request failed. Please try again.";
}

export default function Home() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [busyAccountId, setBusyAccountId] = useState<string | null>(null);

  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountInstitution, setNewAccountInstitution] = useState("");

  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editInstitution, setEditInstitution] = useState("");

  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResponse | null>(null);

  const loadAccounts = useCallback(async () => {
    setAccountsLoading(true);
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
      setAccountsLoading(false);
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

    setAccountsLoading(false);
  }, []);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  async function createAccount() {
    if (!newAccountName.trim()) {
      setAccountError("Account name is required.");
      return;
    }

    setBusyAccountId("new");
    setAccountError(null);

    const response = await fetch("/api/accounts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: newAccountName.trim(),
        institution: newAccountInstitution.trim() || undefined,
      }),
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      setAccountError(getErrorMessage(response.status, body));
      setBusyAccountId(null);
      return;
    }

    setNewAccountName("");
    setNewAccountInstitution("");
    setBusyAccountId(null);
    await loadAccounts();
  }

  function startEdit(account: Account) {
    setEditingAccountId(account.id);
    setEditName(account.name);
    setEditInstitution(account.institution ?? "");
  }

  async function saveEdit(accountId: string) {
    if (!editName.trim()) {
      setAccountError("Account name is required.");
      return;
    }

    setBusyAccountId(accountId);
    setAccountError(null);

    const response = await fetch(`/api/accounts/${accountId}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: editName.trim(),
        institution: editInstitution.trim() || null,
      }),
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      setAccountError(getErrorMessage(response.status, body));
      setBusyAccountId(null);
      return;
    }

    setEditingAccountId(null);
    setBusyAccountId(null);
    await loadAccounts();
  }

  async function deleteAccount(accountId: string) {
    if (!window.confirm("Delete this account?")) {
      return;
    }

    setBusyAccountId(accountId);
    setAccountError(null);

    const response = await fetch(`/api/accounts/${accountId}`, {
      method: "DELETE",
    });

    const body = await response.json().catch(() => null);

    if (!response.ok && response.status !== 204) {
      setAccountError(getErrorMessage(response.status, body));
      setBusyAccountId(null);
      return;
    }

    setBusyAccountId(null);
    await loadAccounts();
  }

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
      setImportError(getErrorMessage(response.status, body));
      setImportResult(null);
      setImportLoading(false);
      return;
    }

    setImportResult(body as ImportResponse);
    setImportLoading(false);
  }

  const hasAccounts = accounts.length > 0;
  const activeAccounts = useMemo(
    () => accounts.filter((account) => account.isActive),
    [accounts],
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-100 via-white to-zinc-50 px-5 py-8 text-zinc-900 md:px-10">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-600">
            Inflation Station
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Accounts and CSV Import
          </h1>
          <p className="text-sm text-zinc-600">
            Manage monitored accounts and import bank transactions.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <div className="space-y-1">
              <CardTitle>Account Management</CardTitle>
              <CardDescription>
                Add, rename, and remove accounts used in imports.
              </CardDescription>
            </div>

            <div className="mt-4 grid gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-4">
              <label
                htmlFor="new-account-name"
                className="text-sm font-medium text-zinc-800"
              >
                Account name
              </label>
              <Input
                id="new-account-name"
                value={newAccountName}
                onChange={(event) => setNewAccountName(event.target.value)}
                placeholder="Spending Account"
              />
              <label
                htmlFor="new-account-institution"
                className="text-sm font-medium text-zinc-800"
              >
                Institution (optional)
              </label>
              <Input
                id="new-account-institution"
                value={newAccountInstitution}
                onChange={(event) =>
                  setNewAccountInstitution(event.target.value)
                }
                placeholder="DNB"
              />
              <Button
                onClick={createAccount}
                disabled={busyAccountId === "new"}
              >
                {busyAccountId === "new" ? "Saving..." : "Add account"}
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

            <div className="mt-4 overflow-x-auto rounded-md border border-zinc-200">
              <Table>
                <THead>
                  <tr>
                    <TH>Name</TH>
                    <TH>Institution</TH>
                    <TH>Status</TH>
                    <TH className="text-right">Actions</TH>
                  </tr>
                </THead>
                <TBody>
                  {accountsLoading ? (
                    <tr>
                      <TD colSpan={4}>Loading accounts...</TD>
                    </tr>
                  ) : null}
                  {!accountsLoading && !hasAccounts ? (
                    <tr>
                      <TD colSpan={4}>No accounts yet.</TD>
                    </tr>
                  ) : null}
                  {!accountsLoading
                    ? accounts.map((account) => {
                        const isEditing = editingAccountId === account.id;
                        const isBusy = busyAccountId === account.id;

                        return (
                          <tr key={account.id}>
                            <TD>
                              {isEditing ? (
                                <Input
                                  aria-label={`Edit name ${account.name}`}
                                  value={editName}
                                  onChange={(event) =>
                                    setEditName(event.target.value)
                                  }
                                />
                              ) : (
                                account.name
                              )}
                            </TD>
                            <TD>
                              {isEditing ? (
                                <Input
                                  aria-label={`Edit institution ${account.name}`}
                                  value={editInstitution}
                                  onChange={(event) =>
                                    setEditInstitution(event.target.value)
                                  }
                                />
                              ) : (
                                (account.institution ?? "-")
                              )}
                            </TD>
                            <TD>{account.isActive ? "Active" : "Inactive"}</TD>
                            <TD>
                              <div className="flex justify-end gap-2">
                                {isEditing ? (
                                  <>
                                    <Button
                                      variant="secondary"
                                      onClick={() => saveEdit(account.id)}
                                      disabled={isBusy}
                                    >
                                      Save
                                    </Button>
                                    <Button
                                      variant="outline"
                                      onClick={() => setEditingAccountId(null)}
                                      disabled={isBusy}
                                    >
                                      Cancel
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button
                                      variant="outline"
                                      onClick={() => startEdit(account)}
                                      disabled={isBusy}
                                    >
                                      Rename
                                    </Button>
                                    <Button
                                      variant="destructive"
                                      onClick={() => deleteAccount(account.id)}
                                      disabled={isBusy}
                                    >
                                      Remove
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TD>
                          </tr>
                        );
                      })
                    : null}
                </TBody>
              </Table>
            </div>
          </Card>

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
                className="text-sm font-medium text-zinc-800"
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
                onClick={importCsv}
                disabled={!hasAccounts || importLoading}
              >
                {importLoading ? "Importing..." : "Import transactions"}
              </Button>
            </div>

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
                className="mt-4 space-y-4 rounded-md border border-zinc-200 bg-zinc-50 p-4"
              >
                <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-700">
                  Import summary
                </h2>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-zinc-600">Imported</dt>
                    <dd className="font-semibold">
                      {importResult.summary.imported}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-600">Duplicates</dt>
                    <dd className="font-semibold">
                      {importResult.summary.duplicates}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-600">Ignored reserved</dt>
                    <dd className="font-semibold">
                      {importResult.summary.ignoredReserved}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-600">Invalid</dt>
                    <dd className="font-semibold">
                      {importResult.summary.invalid}
                    </dd>
                  </div>
                </dl>

                {importResult.errors.length > 0 ? (
                  <div className="rounded-md border border-zinc-200 bg-white p-3">
                    <h3 className="text-sm font-semibold">Validation errors</h3>
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-zinc-700">
                      {importResult.errors.slice(0, 5).map((error) => (
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
      </main>
    </div>
  );
}
