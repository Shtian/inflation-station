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
  manageHref: "/accounts" | "/categories";
  presentItems: (snapshot: SetupSnapshot) => string[];
  isComplete: (snapshot: SetupSnapshot) => boolean;
};

function defineStep(step: Omit<OnboardingStep, "isComplete">): OnboardingStep {
  return {
    ...step,
    isComplete: (snapshot) => step.presentItems(snapshot).length > 0,
  };
}

export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  defineStep({
    id: "accounts",
    title: "Legg til kontoene dine",
    description:
      "Bankkontoene og kortene du importerer kontoutskrifter fra, så hver transaksjon hører til et sted.",
    agentGuidance:
      "Ask which accounts the user wants to track: the bank (institution) and the account name, for example DNB Brukskonto or Sbanken Kredittkort. Propose all of them in one addAccounts call.",
    manageHref: "/accounts",
    presentItems: (snapshot) =>
      snapshot.accounts.map(({ name, institution }) =>
        institution ? `${name} (${institution})` : name,
      ),
  }),
  defineStep({
    id: "categories",
    title: "Opprett kategorier",
    description:
      "Utgifts- og inntektskategorier, hver med et kort hint som hjelper AI-kategoriseringen.",
    agentGuidance:
      "Ask briefly about the user's spending habits (groceries, housing, transport, subscriptions, eating out, income). Propose EXPENSE and INCOME categories in one addCategories call. Give each a short, concrete classifier hint that names typical merchants or keywords, for example Rema, Kiwi, Coop, Meny for groceries. Explain once that hints help the AI categorizer tell categories apart when it sorts imported transactions.",
    manageHref: "/categories",
    presentItems: (snapshot) =>
      snapshot.categories
        .filter((category) => category.kind !== "TRANSFER")
        .map((category) => category.name),
  }),
  defineStep({
    id: "transfer",
    title: "Skjul overføringer",
    description:
      "En overføringskategori for penger du flytter mellom egne kontoer, så de holdes utenfor statistikken.",
    agentGuidance:
      "Suggest one TRANSFER category, for example Overføringer, with a hint such as: Overføring mellom egne kontoer, sparing til egen sparekonto. Explain that the dashboard leaves TRANSFER categories out of its statistics, and that this is currently the way to hide transfers between the user's own accounts.",
    manageHref: "/categories",
    presentItems: (snapshot) =>
      snapshot.categories
        .filter((category) => category.kind === "TRANSFER")
        .map((category) => category.name),
  }),
];

export type OnboardingStepStatus = "done" | "current" | "upcoming";

export function resolveStepStatus(
  step: OnboardingStep,
  snapshot: SetupSnapshot,
): OnboardingStepStatus {
  if (step.isComplete(snapshot)) {
    return "done";
  }
  return resolveCurrentStep(snapshot) === step.id ? "current" : "upcoming";
}

export function resolveCurrentStep(
  snapshot: SetupSnapshot,
): OnboardingStepId | "done" {
  return (
    ONBOARDING_STEPS.find((step) => !step.isComplete(snapshot))?.id ?? "done"
  );
}
