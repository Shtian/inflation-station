import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type DeleteTransactionDialogProps = {
  open: boolean;
  deleteError: string | null;
  deleteSaving: boolean;
  onOpenChange: (nextOpen: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DeleteTransactionDialog({
  open,
  deleteError,
  deleteSaving,
  onOpenChange,
  onCancel,
  onConfirm,
}: DeleteTransactionDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete transaction</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove the selected transaction.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {deleteError ? (
          <p
            role="alert"
            className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-destructive text-sm"
          >
            {deleteError}
          </p>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} disabled={deleteSaving}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={onConfirm}
            disabled={deleteSaving}
          >
            {deleteSaving ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
