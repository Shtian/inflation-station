"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { resolveCurrentStep } from "@/lib/onboarding/progress";
import { OnboardingChat } from "./onboarding-chat";
import { OnboardingStepper } from "./onboarding-stepper";
import { useSetupSnapshot } from "./use-setup-snapshot";

export function OnboardingGuide({ chatEnabled }: { chatEnabled: boolean }) {
  const { state, reload } = useSetupSnapshot();
  const snapshot = state.status === "ready" ? state.snapshot : null;
  const isDone = snapshot !== null && resolveCurrentStep(snapshot) === "done";
  const canMoveOn = snapshot !== null && snapshot.accounts.length > 0;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
      <aside className="flex flex-col gap-6">
        <OnboardingStepper snapshot={snapshot} />
        {state.status === "error" ? (
          <div className="flex items-center gap-2 text-destructive text-xs">
            <span className="flex-1">Couldn't load your setup progress.</span>
            <Button size="xs" variant="outline" onClick={() => void reload()}>
              Retry
            </Button>
          </div>
        ) : null}
        {canMoveOn ? (
          <div className="flex flex-col gap-2">
            <p className="text-muted-foreground text-xs">
              {isDone
                ? "You're all set. Import a bank statement to see your spending."
                : "You can finish the remaining steps later."}
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/import"
                className={buttonVariants({
                  variant: isDone ? "default" : "outline",
                  size: "sm",
                })}
              >
                Import a statement
                <ArrowRight data-icon="inline-end" />
              </Link>
              <Link
                href="/"
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                Go to dashboard
              </Link>
            </div>
          </div>
        ) : null}
      </aside>

      {chatEnabled ? (
        <OnboardingChat onSetupChanged={() => void reload()} />
      ) : (
        <div className="flex flex-col gap-2 text-sm">
          <h2 className="font-medium text-foreground">Chat unavailable</h2>
          <p className="max-w-prose text-muted-foreground">
            The setup guide chat needs an OpenAI API key (OPENAI_API_KEY) on the
            server. You can still do every step by hand on the Accounts and
            Categories pages linked beside each step.
          </p>
        </div>
      )}
    </div>
  );
}
