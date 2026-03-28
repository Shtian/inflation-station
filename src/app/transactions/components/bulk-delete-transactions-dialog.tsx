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

type BulkDeleteTransactionsDialogProps = {
  open: boolean;
  count: number;
  deleteError: string | null;
  deleteSaving: boolean;
  onOpenChange: (nextOpen: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export function BulkDeleteTransactionsDialog({
  open,
  count,
  deleteError,
  deleteSaving,
  onOpenChange,
  onCancel,
  onConfirm,
}: BulkDeleteTransactionsDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete {count} transaction{count !== 1 ? "s" : ""}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This cannot be undone.
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
