export type CategoryKindName = "EXPENSE" | "INCOME" | "TRANSFER";

export type SetupSnapshot = {
  accounts: { name: string; institution: string | null }[];
  categories: {
    name: string;
    kind: CategoryKindName;
    classifierHint: string | null;
  }[];
};

export type OnboardingStepId = "accounts" | "categories" | "transfer";

export type OnboardingStep = {
  id: OnboardingStepId;
  title: string;
  description: string;
  agentGuidance: string;
  isComplete: (snapshot: SetupSnapshot) => boolean;
};

export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  {
    id: "accounts",
    title: "Add your accounts",
    description:
      "The bank accounts and cards you import statements from, so every transaction has a home.",
    agentGuidance:
      "Ask which accounts the user wants to track: the bank (institution) and the account name, for example DNB Brukskonto or Sbanken Kredittkort. Propose all of them in one addAccounts call.",
    isComplete: (snapshot) => snapshot.accounts.length > 0,
  },
  {
    id: "categories",
    title: "Create categories",
    description:
      "Spending and income categories, each with a short hint that helps the AI categorizer.",
    agentGuidance:
      "Ask briefly about the user's spending habits (groceries, housing, transport, subscriptions, eating out, income). Propose EXPENSE and INCOME categories in one addCategories call. Give each a short, concrete classifier hint that names typical merchants or keywords, for example Rema, Kiwi, Coop, Meny for groceries. Explain once that hints help the AI categorizer tell categories apart when it sorts imported transactions.",
    isComplete: (snapshot) =>
      snapshot.categories.some((category) => category.kind !== "TRANSFER"),
  },
  {
    id: "transfer",
    title: "Hide transfers",
    description:
      "A transfer category for moves between your own accounts, so they stay out of your statistics.",
    agentGuidance:
      "Suggest one TRANSFER category, for example Overføringer, with a hint such as: Overføring mellom egne kontoer, sparing til egen sparekonto. Explain that the dashboard leaves TRANSFER categories out of its statistics, and that this is currently the way to hide transfers between the user's own accounts.",
    isComplete: (snapshot) =>
      snapshot.categories.some((category) => category.kind === "TRANSFER"),
  },
];

export function resolveCurrentStep(
  snapshot: SetupSnapshot,
): OnboardingStepId | "done" {
  return (
    ONBOARDING_STEPS.find((step) => !step.isComplete(snapshot))?.id ?? "done"
  );
}
