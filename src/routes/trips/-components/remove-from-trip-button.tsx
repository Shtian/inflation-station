import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useTransition } from "react";
import { toast } from "sonner";
import { describeMembershipChange } from "@/app/trips/format";
import { Button } from "@/components/ui/button";
import { setTripMembershipFn } from "../-server";

const FAILED_MESSAGE = "Kunne ikke oppdatere turen. Prøv igjen.";

type SetTripMembership = ReturnType<
  typeof useServerFn<typeof setTripMembershipFn>
>;

async function undoRemoval(
  setTripMembership: SetTripMembership,
  invalidate: () => Promise<void>,
  tripId: string,
  transactionId: string,
) {
  try {
    const result = await setTripMembership({
      data: { tripId, add: [transactionId], remove: [] },
    });
    if (result.ok) {
      await invalidate();
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
  const router = useRouter();
  const setTripMembership = useServerFn(setTripMembershipFn);
  const [removing, startRemoving] = useTransition();

  function handleClick() {
    startRemoving(async () => {
      try {
        const result = await setTripMembership({
          data: { tripId, add: [], remove: [transactionId] },
        });
        if (result.ok) {
          await router.invalidate();
          toast.success(describeMembershipChange(result.data), {
            action: {
              label: "Angre",
              onClick: () =>
                void undoRemoval(
                  setTripMembership,
                  () => router.invalidate(),
                  tripId,
                  transactionId,
                ),
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
