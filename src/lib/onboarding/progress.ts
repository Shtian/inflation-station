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
  isComplete: (snapshot: SetupSnapshot) => boolean;
};

export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  {
    id: "accounts",
    title: "Add your accounts",
    description:
      "The bank accounts and cards you import statements from, so every transaction has a home.",
    isComplete: (snapshot) => snapshot.accounts.length > 0,
  },
  {
    id: "categories",
    title: "Create categories",
    description:
      "Spending and income categories, each with a short hint that helps the AI categorizer.",
    isComplete: (snapshot) =>
      snapshot.categories.some((category) => category.kind !== "TRANSFER"),
  },
  {
    id: "transfer",
    title: "Hide transfers",
    description:
      "A transfer category for moves between your own accounts, so they stay out of your statistics.",
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
