"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { setTripMembershipAction } from "@/app/actions/trips";
import { Button } from "@/components/ui/button";
import { describeMembershipChange } from "../format";

const FAILED_MESSAGE = "Kunne ikke oppdatere turen. Prøv igjen.";

async function undoRemoval(tripId: string, transactionId: string) {
  try {
    const result = await setTripMembershipAction({
      tripId,
      add: [transactionId],
      remove: [],
    });
    if (result.ok) {
      toast.success(describeMembershipChange(result.data));
    } else {
      toast.error(result.error.message);
    }
  } catch {
    toast.error(FAILED_MESSAGE);
  }
}

export function RemoveFromTripButton({
  tripId,
  transactionId,
  merchant,
}: {
  tripId: string;
  transactionId: string;
  merchant: string;
}) {
  const [removing, startRemoving] = useTransition();

  function handleClick() {
    startRemoving(async () => {
      try {
        const result = await setTripMembershipAction({
          tripId,
          add: [],
          remove: [transactionId],
        });
        if (result.ok) {
          toast.success(describeMembershipChange(result.data), {
            action: {
              label: "Angre",
              onClick: () => void undoRemoval(tripId, transactionId),
            },
          });
        } else {
          toast.error(result.error.message);
        }
      } catch {
        toast.error(FAILED_MESSAGE);
      }
    });
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      disabled={removing}
      aria-label={`Fjern ${merchant} fra turen`}
    >
      Fjern
    </Button>
  );
}
