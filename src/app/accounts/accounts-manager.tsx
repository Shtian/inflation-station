"use client";

import { Separator } from "@/components/ui/separator";
import { AccountsTableSection } from "./components/accounts-table-section";
import { CreateAccountSection } from "./components/create-account-section";
import { useAccountsManager } from "./use-accounts-manager";

export function AccountsManager() {
  const {
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
  } = useAccountsManager();

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="font-semibold text-2xl text-foreground tracking-tight">
          Accounts
        </h1>
        <p className="text-muted-foreground text-sm">
          Add, rename, and remove accounts used in imports.
        </p>
      </div>

      <Separator className="my-4" />

      <CreateAccountSection
        busyAccountId={busyAccountId}
        newAccountInstitution={newAccountInstitution}
        newAccountName={newAccountName}
        onCreateAccount={createAccount}
        onInstitutionChange={setNewAccountInstitution}
        onNameChange={setNewAccountName}
      />

      {accountError ? (
        <p
          role="alert"
          className="mt-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-red-700 text-sm"
        >
          {accountError}
        </p>
      ) : null}

      <Separator className="my-4" />

      <AccountsTableSection
        accounts={accounts}
        accountsLoading={accountsLoading}
        busyAccountId={busyAccountId}
        editInstitution={editInstitution}
        editName={editName}
        editingAccountId={editingAccountId}
        onCancelEdit={() => setEditingAccountId(null)}
        onDeleteAccount={deleteAccount}
        onEditInstitutionChange={setEditInstitution}
        onEditNameChange={setEditName}
        onSaveEdit={saveEdit}
        onStartEdit={startEdit}
      />
    </div>
  );
}
