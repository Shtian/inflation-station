import { Check, Ellipsis, Loader2, Pencil, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
            <TableHead>Navn</TableHead>
            <TableHead>Institusjon</TableHead>
            <TableHead>Tilstand</TableHead>
            <TableHead className="text-right">Handlinger</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {accountsLoading ? (
            <TableRow>
              <TableCell colSpan={4}>Laster inn kontoer…</TableCell>
            </TableRow>
          ) : null}
          {!accountsLoading && accounts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4}>Ingen kontoer ennå.</TableCell>
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
                          aria-label={`Rediger navn ${account.name}`}
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
                          aria-label={`Rediger institusjon ${account.name}`}
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
                      {account.isActive ? (
                        <Badge className="border-success/30 bg-success/10 text-success">
                          Aktiv
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-muted-foreground"
                        >
                          Inaktiv
                        </Badge>
                      )}
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
                              Lagre
                            </Button>
                            <Button
                              variant="outline"
                              onClick={onCancelEdit}
                              disabled={isBusy}
                              className="gap-2"
                            >
                              <X className="h-4 w-4" aria-hidden="true" />
                              Avbryt
                            </Button>
                          </>
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon-sm"
                                  aria-label={`Handlinger for kontoen ${account.name}`}
                                  title={`Handlinger for kontoen ${account.name}`}
                                  disabled={isBusy}
                                >
                                  {isBusy ? (
                                    <Loader2
                                      className="h-4 w-4 animate-spin"
                                      aria-hidden="true"
                                    />
                                  ) : (
                                    <Ellipsis
                                      className="h-4 w-4"
                                      aria-hidden="true"
                                    />
                                  )}
                                  <span className="sr-only">Handlinger</span>
                                </Button>
                              }
                            />
                            <DropdownMenuContent align="end">
                              <DropdownMenuGroup>
                                <DropdownMenuItem
                                  onClick={() => onStartEdit(account)}
                                >
                                  <Pencil
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                  />
                                  Gi nytt navn
                                </DropdownMenuItem>
                              </DropdownMenuGroup>
                              <DropdownMenuSeparator />
                              <DropdownMenuGroup>
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() =>
                                    void onDeleteAccount(account.id)
                                  }
                                >
                                  <Trash2
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                  />
                                  Slett
                                </DropdownMenuItem>
                              </DropdownMenuGroup>
                            </DropdownMenuContent>
                          </DropdownMenu>
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
