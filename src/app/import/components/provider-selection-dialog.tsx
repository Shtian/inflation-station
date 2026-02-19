import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type ProviderOption = {
  id: string;
  name: string;
};

type ProviderSelectionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerOptions: ProviderOption[];
  selectedProviderId: string;
  onSelectProvider: (providerId: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ProviderSelectionDialog({
  open,
  onOpenChange,
  providerOptions,
  selectedProviderId,
  onSelectProvider,
  onCancel,
  onConfirm,
}: ProviderSelectionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Select provider</DialogTitle>
          <DialogDescription>
            Choose the provider that matches your CSV file format.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {providerOptions.map((provider) => (
            <button
              key={provider.id}
              type="button"
              onClick={() => onSelectProvider(provider.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent",
                selectedProviderId === provider.id
                  ? "border-primary bg-primary/5"
                  : "border-border",
              )}
            >
              <div
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                  selectedProviderId === provider.id
                    ? "border-primary bg-primary"
                    : "border-muted-foreground",
                )}
              >
                {selectedProviderId === provider.id ? (
                  <div className="h-2 w-2 rounded-full bg-primary-foreground" />
                ) : null}
              </div>
              <span className="text-sm font-medium">{provider.name}</span>
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={!selectedProviderId}
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
