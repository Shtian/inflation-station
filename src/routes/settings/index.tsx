import { createFileRoute } from "@tanstack/react-router";
import { MessageCleanupSettingsSection } from "@/app/settings/components/message-cleanup-settings-section";
import { MonthlyReviewSettingsSection } from "@/app/settings/components/monthly-review-settings-section";
import {
  SettingsError,
  SettingsPending,
} from "./-components/settings-route-states";

export const Route = createFileRoute("/settings/")({
  head: () => ({ meta: [{ title: "Innstillinger · Inflation Station" }] }),
  pendingComponent: SettingsPending,
  errorComponent: SettingsError,
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 px-5 py-8 md:px-10">
      <div className="space-y-1">
        <h1 className="font-semibold text-2xl text-foreground tracking-tight">
          Innstillinger
        </h1>
        <p className="text-muted-foreground text-sm">
          Velg modeller og instruksjoner for AI-funksjonene i appen.
        </p>
      </div>
      <MessageCleanupSettingsSection />
      <MonthlyReviewSettingsSection />
    </main>
  );
}
