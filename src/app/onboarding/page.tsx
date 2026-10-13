import { Separator } from "@/components/ui/separator";
import { resolveOnboardingDisabledReason } from "@/lib/onboarding/agent";
import { OnboardingGuide } from "./onboarding-guide";

// The API key is read per request, so a key added after the build still
// enables the chat.
export const dynamic = "force-dynamic";

export default function OnboardingPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 md:px-10">
      <div className="space-y-1">
        <h1 className="font-semibold text-2xl text-foreground tracking-tight">
          Kom i gang
        </h1>
        <p className="text-muted-foreground text-sm">
          Legg til kontoer og kategorier i tre korte steg, ved å chatte med
          oppsettsguiden eller for hånd.
        </p>
      </div>
      <Separator className="my-6" />
      <OnboardingGuide
        chatEnabled={resolveOnboardingDisabledReason() === null}
      />
    </main>
  );
}
