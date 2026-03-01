import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldContent, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

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
      <Field>
        <FieldLabel htmlFor="new-account-name">Account name</FieldLabel>
        <FieldContent>
          <Input
            id="new-account-name"
            value={newAccountName}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="Spending Account"
          />
        </FieldContent>
      </Field>
      <Field>
        <FieldLabel htmlFor="new-account-institution">
          Institution (optional)
        </FieldLabel>
        <FieldContent>
          <Input
            id="new-account-institution"
            value={newAccountInstitution}
            onChange={(event) => onInstitutionChange(event.target.value)}
            placeholder="DNB"
          />
        </FieldContent>
      </Field>
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
