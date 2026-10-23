import { createFileRoute } from "@tanstack/react-router";
import { OnboardingGuide } from "@/app/onboarding/onboarding-guide";
import { Separator } from "@/components/ui/separator";
import {
  OnboardingError,
  OnboardingPending,
} from "./-components/onboarding-route-states";
import { getOnboardingPage } from "./-server";

export const Route = createFileRoute("/onboarding/")({
  loader: () => getOnboardingPage(),
  head: () => ({ meta: [{ title: "Kom i gang · Inflation Station" }] }),
  pendingComponent: OnboardingPending,
  errorComponent: OnboardingError,
  component: OnboardingPage,
});

function OnboardingPage() {
  const { chatEnabled } = Route.useLoaderData();

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 md:px-10">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Kom i gang
        </h1>
        <p className="text-sm text-muted-foreground">
          Legg til kontoer og kategorier i tre korte steg, ved å chatte med
          oppsettsguiden eller for hånd.
        </p>
      </div>
      <Separator className="my-6" />
      <OnboardingGuide chatEnabled={chatEnabled} />
    </main>
  );
}
