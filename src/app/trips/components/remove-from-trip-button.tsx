"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { setTripMembershipAction } from "@/app/actions/trips";
import { Button } from "@/components/ui/button";
import { describeMembershipChange } from "../format";

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
          toast.success(describeMembershipChange(result.data));
        } else {
          toast.error(result.error.message);
        }
      } catch {
        toast.error("Kunne ikke oppdatere turen. Prøv igjen.");
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
