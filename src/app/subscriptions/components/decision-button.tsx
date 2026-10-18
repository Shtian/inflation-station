"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  clearSubscriptionDecisionAction,
  setSubscriptionDecisionAction,
} from "@/app/actions/subscription-decisions";
import { Button } from "@/components/ui/button";
import type { MutationActionResult } from "@/lib/server-actions/mutation-result";
import type { SubscriptionDecisionStatus } from "@/lib/subscriptions/model";

export type DecisionIntent =
  | "CONFIRM"
  | "DISMISS"
  | "RESTORE"
  | "UNCONFIRM"
  | "END"
  | "RECONFIRM";

/** One decision write and the toast that reports it. */
type DecisionStep = {
  run: (normalizedMerchant: string) => Promise<MutationActionResult<unknown>>;
  success: (name: string) => string;
};

const setStatus =
  (status: SubscriptionDecisionStatus) => (normalizedMerchant: string) =>
    setSubscriptionDecisionAction({ normalizedMerchant, status });

const clearDecision = (normalizedMerchant: string) =>
  clearSubscriptionDecisionAction({ normalizedMerchant });

const backToSuggestions: DecisionStep = {
  run: clearDecision,
  success: (name) => `${name} er tilbake blant forslagene`,
};

const INTENTS: Record<
  DecisionIntent,
  {
    label: string;
    variant: "default" | "outline" | "ghost";
    apply: DecisionStep;
    /** Restores the status the merchant had before `apply`. */
    undo: DecisionStep;
  }
> = {
  CONFIRM: {
    label: "Bekreft",
    variant: "default",
    apply: {
      run: setStatus("CONFIRMED"),
      success: (name) => `${name} er lagt til i faste trekk`,
    },
    undo: backToSuggestions,
  },
  DISMISS: {
    label: "Avvis",
    variant: "outline",
    apply: {
      run: setStatus("DISMISSED"),
      success: (name) => `${name} er avvist`,
    },
    undo: backToSuggestions,
  },
  RESTORE: {
    label: "Gjenopprett",
    variant: "outline",
    apply: backToSuggestions,
    undo: {
      run: setStatus("DISMISSED"),
      success: (name) => `${name} er avvist igjen`,
    },
  },
  UNCONFIRM: {
    label: "Fjern",
    variant: "ghost",
    apply: {
      run: clearDecision,
      success: (name) => `${name} er flyttet tilbake til forslagene`,
    },
    undo: {
      run: setStatus("CONFIRMED"),
      success: (name) => `${name} er bekreftet igjen`,
    },
  },
  END: {
    label: "Marker som avsluttet",
    variant: "outline",
    apply: {
      run: setStatus("ENDED"),
      success: (name) => `${name} er markert som avsluttet`,
    },
    undo: {
      run: setStatus("CONFIRMED"),
      success: (name) => `${name} er tilbake blant de bekreftede`,
    },
  },
  RECONFIRM: {
    label: "Bekreft igjen",
    variant: "outline",
    apply: {
      run: setStatus("CONFIRMED"),
      success: (name) => `${name} er bekreftet igjen`,
    },
    undo: {
      run: setStatus("ENDED"),
      success: (name) => `${name} er markert som avsluttet igjen`,
    },
  },
};

const FAILED_MESSAGE = "Kunne ikke lagre valget. Prøv igjen.";

async function runStep(
  step: DecisionStep,
  normalizedMerchant: string,
  displayName: string,
  undo?: DecisionStep,
): Promise<void> {
  try {
    const result = await step.run(normalizedMerchant);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success(
      step.success(displayName),
      undo && {
        action: {
          label: "Angre",
          onClick: () => void runStep(undo, normalizedMerchant, displayName),
        },
      },
    );
  } catch {
    toast.error(FAILED_MESSAGE);
  }
}

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
  const { label, variant, apply, undo } = INTENTS[intent];

  return (
    <Button
      type="button"
      size="sm"
      variant={variant}
      disabled={pending}
      aria-label={`${label} ${displayName}`}
      onClick={() =>
        startTransition(() =>
          runStep(apply, normalizedMerchant, displayName, undo),
        )
      }
    >
      {label}
    </Button>
  );
}
