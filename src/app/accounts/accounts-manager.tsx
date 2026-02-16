"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Table, TBody, TD, TH, THead } from "@/components/ui/table";

type Account = {
  id: string;
  name: string;
  institution: string | null;
  isActive: boolean;
};

function getAccountErrorMessage(status: number, body: unknown) {
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

export function AccountsManager() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountNotice, setAccountNotice] = useState<string | null>(null);
  const [busyAccountId, setBusyAccountId] = useState<string | null>(null);

  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountInstitution, setNewAccountInstitution] = useState("");

  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editInstitution, setEditInstitution] = useState("");

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

    setAccounts(
      Array.isArray(body.accounts) ? (body.accounts as Account[]) : [],
    );
    setAccountsLoading(false);
  }, []);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  async function createAccount() {
    if (!newAccountName.trim()) {
      setAccountError("Account name is required.");
      setAccountNotice(null);
      return;
    }

    setBusyAccountId("new");
    setAccountError(null);
    setAccountNotice(null);

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
      setAccountError(getAccountErrorMessage(response.status, body));
      setBusyAccountId(null);
      return;
    }

    setNewAccountName("");
    setNewAccountInstitution("");
    setBusyAccountId(null);
    setAccountNotice("Account added.");
    await loadAccounts();
  }

  function startEdit(account: Account) {
    setEditingAccountId(account.id);
    setEditName(account.name);
    setEditInstitution(account.institution ?? "");
    setAccountError(null);
    setAccountNotice(null);
  }

  async function saveEdit(accountId: string) {
    if (!editName.trim()) {
      setAccountError("Account name is required.");
      setAccountNotice(null);
      return;
    }

    setBusyAccountId(accountId);
    setAccountError(null);
    setAccountNotice(null);

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
      setAccountError(getAccountErrorMessage(response.status, body));
      setBusyAccountId(null);
      return;
    }

    setEditingAccountId(null);
    setBusyAccountId(null);
    setAccountNotice("Account updated.");
    await loadAccounts();
  }

  async function deleteAccount(accountId: string) {
    if (!window.confirm("Delete this account?")) {
      return;
    }

    setBusyAccountId(accountId);
    setAccountError(null);
    setAccountNotice(null);

    const response = await fetch(`/api/accounts/${accountId}`, {
      method: "DELETE",
    });

    const body = await response.json().catch(() => null);

    if (!response.ok && response.status !== 204) {
      setAccountError(getAccountErrorMessage(response.status, body));
      setBusyAccountId(null);
      return;
    }

    setBusyAccountId(null);
    setAccountNotice("Account removed.");
    await loadAccounts();
  }

  return (
    <Card>
      <div className="space-y-1">
        <CardTitle>Accounts</CardTitle>
        <CardDescription>
          Add, rename, and remove accounts used in imports.
        </CardDescription>
      </div>

      <Separator className="my-4" />

      <div className="grid gap-3">
        <label
          htmlFor="new-account-name"
          className="text-sm font-medium text-foreground"
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
          className="text-sm font-medium text-foreground"
        >
          Institution (optional)
        </label>
        <Input
          id="new-account-institution"
          value={newAccountInstitution}
          onChange={(event) => setNewAccountInstitution(event.target.value)}
          placeholder="DNB"
        />
        <Button onClick={createAccount} disabled={busyAccountId === "new"}>
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

      {accountNotice ? (
        <p className="mt-4 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {accountNotice}
        </p>
      ) : null}

      <Separator className="my-4" />

      <div className="overflow-x-auto rounded-md border border-border">
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
            {!accountsLoading && accounts.length === 0 ? (
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
  );
}
