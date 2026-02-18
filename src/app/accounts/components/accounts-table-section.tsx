import { Check, Loader2, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Account } from "../use-accounts-manager";

type AccountsTableSectionProps = {
  accounts: Account[];
  accountsLoading: boolean;
  busyAccountId: string | null;
  editInstitution: string;
  editName: string;
  editingAccountId: string | null;
  onCancelEdit: () => void;
  onDeleteAccount: (accountId: string) => Promise<void>;
  onEditInstitutionChange: (value: string) => void;
  onEditNameChange: (value: string) => void;
  onSaveEdit: (accountId: string) => Promise<void>;
  onStartEdit: (account: Account) => void;
};

export function AccountsTableSection({
  accounts,
  accountsLoading,
  busyAccountId,
  editInstitution,
  editName,
  editingAccountId,
  onCancelEdit,
  onDeleteAccount,
  onEditInstitutionChange,
  onEditNameChange,
  onSaveEdit,
  onStartEdit,
}: AccountsTableSectionProps) {
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Institution</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {accountsLoading ? (
            <TableRow>
              <TableCell colSpan={4}>Loading accounts...</TableCell>
            </TableRow>
          ) : null}
          {!accountsLoading && accounts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4}>No accounts yet.</TableCell>
            </TableRow>
          ) : null}
          {!accountsLoading
            ? accounts.map((account) => {
                const isEditing = editingAccountId === account.id;
                const isBusy = busyAccountId === account.id;

                return (
                  <TableRow key={account.id}>
                    <TableCell>
                      {isEditing ? (
                        <Input
                          aria-label={`Edit name ${account.name}`}
                          value={editName}
                          onChange={(event) =>
                            onEditNameChange(event.target.value)
                          }
                        />
                      ) : (
                        account.name
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input
                          aria-label={`Edit institution ${account.name}`}
                          value={editInstitution}
                          onChange={(event) =>
                            onEditInstitutionChange(event.target.value)
                          }
                        />
                      ) : (
                        (account.institution ?? "-")
                      )}
                    </TableCell>
                    <TableCell>
                      {account.isActive ? "Active" : "Inactive"}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        {isEditing ? (
                          <>
                            <Button
                              variant="secondary"
                              onClick={() => void onSaveEdit(account.id)}
                              disabled={isBusy}
                              className="gap-2"
                            >
                              <Check className="h-4 w-4" aria-hidden="true" />
                              Save
                            </Button>
                            <Button
                              variant="outline"
                              onClick={onCancelEdit}
                              disabled={isBusy}
                              className="gap-2"
                            >
                              <X className="h-4 w-4" aria-hidden="true" />
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="outline"
                              onClick={() => onStartEdit(account)}
                              disabled={isBusy}
                              className="gap-2"
                            >
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                              Rename
                            </Button>
                            <Button
                              variant="destructive"
                              onClick={() => void onDeleteAccount(account.id)}
                              disabled={isBusy}
                              className="h-9 w-9 px-0"
                              aria-label={`Remove account ${account.name}`}
                              title={`Remove account ${account.name}`}
                            >
                              {isBusy ? (
                                <Loader2
                                  className="h-5 w-5 animate-spin"
                                  aria-hidden="true"
                                />
                              ) : (
                                <Trash2
                                  className="h-5 w-5 stroke-[2.25]"
                                  aria-hidden="true"
                                />
                              )}
                              <span className="sr-only">
                                Remove account {account.name}
                              </span>
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            : null}
        </TableBody>
      </Table>
    </div>
  );
}
