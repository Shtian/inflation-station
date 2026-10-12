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
          Get set up
        </h1>
        <p className="text-muted-foreground text-sm">
          Add your accounts and categories in three short steps, by chatting
          with the setup guide or by hand.
        </p>
      </div>
      <Separator className="my-6" />
      <OnboardingGuide
        chatEnabled={resolveOnboardingDisabledReason() === null}
      />
    </main>
  );
}
