"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  clearSubscriptionDecisionAction,
  setSubscriptionDecisionAction,
} from "@/app/actions/subscription-decisions";
import { Button } from "@/components/ui/button";
import type { MutationActionResult } from "@/lib/server-actions/mutation-result";

type DecisionIntent = "CONFIRM" | "DISMISS" | "RESTORE" | "UNCONFIRM";

const INTENTS: Record<
  DecisionIntent,
  {
    label: string;
    variant: "default" | "outline" | "ghost";
    success: (name: string) => string;
    run: (normalizedMerchant: string) => Promise<MutationActionResult<unknown>>;
  }
> = {
  CONFIRM: {
    label: "Bekreft",
    variant: "default",
    success: (name) => `${name} er lagt til i faste trekk`,
    run: (normalizedMerchant) =>
      setSubscriptionDecisionAction({
        normalizedMerchant,
        status: "CONFIRMED",
      }),
  },
  DISMISS: {
    label: "Avvis",
    variant: "outline",
    success: (name) => `${name} er avvist`,
    run: (normalizedMerchant) =>
      setSubscriptionDecisionAction({
        normalizedMerchant,
        status: "DISMISSED",
      }),
  },
  RESTORE: {
    label: "Gjenopprett",
    variant: "outline",
    success: (name) => `${name} er tilbake blant forslagene`,
    run: (normalizedMerchant) =>
      clearSubscriptionDecisionAction({ normalizedMerchant }),
  },
  UNCONFIRM: {
    label: "Fjern",
    variant: "ghost",
    success: (name) => `${name} er flyttet tilbake til forslagene`,
    run: (normalizedMerchant) =>
      clearSubscriptionDecisionAction({ normalizedMerchant }),
  },
};

type DecisionButtonProps = {
  intent: DecisionIntent;
  normalizedMerchant: string;
  displayName: string;
};

export function DecisionButton({
  intent,
  normalizedMerchant,
  displayName,
}: DecisionButtonProps) {
  const [pending, startTransition] = useTransition();
  const { label, variant, success, run } = INTENTS[intent];

  function handleClick() {
    startTransition(async () => {
      try {
        const result = await run(normalizedMerchant);
        if (!result.ok) {
          toast.error(result.error.message);
          return;
        }
        toast.success(success(displayName));
      } catch {
        toast.error("Kunne ikke lagre valget. Prøv igjen.");
      }
    });
  }

  return (
    <Button
      type="button"
      size="sm"
      variant={variant}
      disabled={pending}
      aria-label={`${label} ${displayName}`}
      onClick={handleClick}
    >
      {label}
    </Button>
  );
}
