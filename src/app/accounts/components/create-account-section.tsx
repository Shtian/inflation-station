import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CreateAccountSectionProps = {
  busyAccountId: string | null;
  newAccountInstitution: string;
  newAccountName: string;
  onCreateAccount: () => Promise<void>;
  onInstitutionChange: (value: string) => void;
  onNameChange: (value: string) => void;
};

export function CreateAccountSection({
  busyAccountId,
  newAccountInstitution,
  newAccountName,
  onCreateAccount,
  onInstitutionChange,
  onNameChange,
}: CreateAccountSectionProps) {
  return (
    <div className="grid gap-3">
      <Label
        htmlFor="new-account-name"
        className="font-medium text-foreground text-sm"
      >
        Account name
      </Label>
      <Input
        id="new-account-name"
        value={newAccountName}
        onChange={(event) => onNameChange(event.target.value)}
        placeholder="Spending Account"
      />
      <Label
        htmlFor="new-account-institution"
        className="font-medium text-foreground text-sm"
      >
        Institution (optional)
      </Label>
      <Input
        id="new-account-institution"
        value={newAccountInstitution}
        onChange={(event) => onInstitutionChange(event.target.value)}
        placeholder="DNB"
      />
      <Button
        onClick={() => void onCreateAccount()}
        disabled={busyAccountId === "new"}
        className="gap-2"
      >
        {busyAccountId === "new" ? (
          "Saving..."
        ) : (
          <>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add account
          </>
        )}
      </Button>
    </div>
  );
}
