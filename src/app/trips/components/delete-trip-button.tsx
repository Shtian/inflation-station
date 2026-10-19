"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteTripAction } from "@/app/actions/trips";
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

export function DeleteTripButton({
  tripId,
  name,
}: {
  tripId: string;
  name: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, startDeleting] = useTransition();

  function handleConfirm() {
    startDeleting(async () => {
      const result = await deleteTripAction({ tripId });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setOpen(false);
      toast.success("Turen er slettet.");
      router.push("/trips");
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
