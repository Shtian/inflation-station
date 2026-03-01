"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

export type Account = {
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

export function useAccountsManager() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountError, setAccountError] = useState<string | null>(null);
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
      setAccountError(getAccountErrorMessage(response.status, body));
      setBusyAccountId(null);
      return;
    }

    setNewAccountName("");
    setNewAccountInstitution("");
    setBusyAccountId(null);
    toast.success("Account added.");
    await loadAccounts();
  }

  function startEdit(account: Account) {
    setEditingAccountId(account.id);
    setEditName(account.name);
    setEditInstitution(account.institution ?? "");
    setAccountError(null);
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
      setAccountError(getAccountErrorMessage(response.status, body));
      setBusyAccountId(null);
      return;
    }

    setEditingAccountId(null);
    setBusyAccountId(null);
    toast.success("Account updated.");
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
      setAccountError(getAccountErrorMessage(response.status, body));
      setBusyAccountId(null);
      return;
    }

    setBusyAccountId(null);
    toast.success("Account removed.");
    await loadAccounts();
  }

  return {
    accountError,
    accounts,
    accountsLoading,
    busyAccountId,
    editInstitution,
    editName,
    editingAccountId,
    newAccountInstitution,
    newAccountName,
    createAccount,
    deleteAccount,
    saveEdit,
    setEditInstitution,
    setEditName,
    setEditingAccountId,
    setNewAccountInstitution,
    setNewAccountName,
    startEdit,
  };
}
