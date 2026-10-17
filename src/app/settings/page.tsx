import { MessageCleanupSettingsSection } from "./components/message-cleanup-settings-section";
import { MonthlyReviewSettingsSection } from "./components/monthly-review-settings-section";

export default function SettingsPage() {
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
