import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { deleteTripFn } from "../-server";

export function DeleteTripButton({
  tripId,
  name,
}: {
  tripId: string;
  name: string;
}) {
  const navigate = useNavigate();
  const deleteTrip = useServerFn(deleteTripFn);
  const [open, setOpen] = useState(false);
  const [deleting, startDeleting] = useTransition();

  function handleConfirm() {
    startDeleting(async () => {
      const result = await deleteTrip({ data: { tripId } });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setOpen(false);
      toast.success("Turen er slettet.");
      // No invalidate: it would reload this deleted trip. Leaving loads /trips fresh (blocking stale reload).
      await navigate({ to: "/trips" });
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button variant="outline">Slett</Button>} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Slette «{name}»?</AlertDialogTitle>
          <AlertDialogDescription>
            Transaksjonene blir liggende, men mister koblingen til turen.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Avbryt</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={handleConfirm}
            disabled={deleting}
          >
            {deleting ? "Sletter…" : "Slett tur"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
