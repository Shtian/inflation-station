import type { PrismaClient } from "@prisma/client";
import {
  convertToModelMessages,
  isToolUIPart,
  type ModelMessage,
  tool,
} from "ai";
import {
  addAccountsInputSchema,
  addCategoriesInputSchema,
  type OnboardingDisabledReason,
  type OnboardingUIMessage,
} from "./contract";
import {
  ONBOARDING_STEPS,
  resolveCurrentStep,
  resolveStepStatus,
  type SetupSnapshot,
} from "./progress";
import { createAccounts, createCategories } from "./setup-store";

export const ONBOARDING_AGENT_MODEL = "gpt-6-luna";

export function resolveOnboardingDisabledReason(
  env: Record<string, string | undefined> = process.env,
): OnboardingDisabledReason | null {
  return env.OPENAI_API_KEY?.trim() ? null : "key_missing";
}

function describeAccounts(snapshot: SetupSnapshot): string {
  if (snapshot.accounts.length === 0) {
    return "- none yet";
  }
  return snapshot.accounts
    .map(({ name, institution }) =>
      institution ? `- ${name} (${institution})` : `- ${name}`,
    )
    .join("\n");
}

function describeCategories(snapshot: SetupSnapshot): string {
  if (snapshot.categories.length === 0) {
    return "- none yet";
  }
  return snapshot.categories
    .map(({ name, kind, classifierHint }) =>
      classifierHint
        ? `- ${name} [${kind}] hint: ${classifierHint}`
        : `- ${name} [${kind}]`,
    )
    .join("\n");
}

export function buildOnboardingSystemPrompt(snapshot: SetupSnapshot): string {
  const currentStep = resolveCurrentStep(snapshot);
  const steps = ONBOARDING_STEPS.map(
    (step, index) =>
      `${index + 1}. ${step.title} (${resolveStepStatus(step, snapshot)}): ${step.agentGuidance}`,
  ).join("\n");
  const current =
    currentStep === "done"
      ? "All steps are done. Congratulate the user briefly and suggest importing a bank statement on the Import page next. Help with further accounts or categories if they ask."
      : `The current step is "${ONBOARDING_STEPS.find((step) => step.id === currentStep)?.title}". Work on it before moving on.`;

  return `You are the setup guide inside Inflation Station, a personal-finance app that imports bank statements and sorts transactions into categories. You help a new user add their accounts and categories by chatting.

How to work:
- Reply in the user's language (often Norwegian). Keep replies short and friendly; the user is not a developer.
- Follow the steps below in order. Ask one thing at a time.
- Propose additions by calling addAccounts or addCategories. The user sees the proposal and approves or declines it in the UI.
- Never claim something was added unless the tool output says so. The output lists "created" names and "existing" names that were already there; mention both.
- A declined call means the user wants changes. Nothing failed, so do not apologize for an error. Ask briefly what to change, then propose a revised list.
- Do not propose names that already exist below.
- If the user asks about something unrelated to setup, answer briefly and steer back to the current step.

Steps:
${steps}

${current}

Existing accounts:
${describeAccounts(snapshot)}

Existing categories:
${describeCategories(snapshot)}`;
}

const STALE_PROPOSAL_REASON =
  "The user replied in the chat instead of approving this proposal.";

// A proposal left in approval-requested means the user typed a reply instead
// of using the buttons. Sending it as denied keeps the proposal in the model's
// context; an unanswered tool call would otherwise be rejected by the provider.
function withStaleProposalsDenied(
  message: OnboardingUIMessage,
): OnboardingUIMessage {
  return {
    ...message,
    parts: message.parts.map((part) =>
      isToolUIPart(part) && part.state === "approval-requested"
        ? {
            ...part,
            state: "output-denied",
            approval: {
              id: part.approval.id,
              approved: false,
              reason: STALE_PROPOSAL_REASON,
            },
          }
        : part,
    ),
  };
}

export function toModelMessages(
  messages: OnboardingUIMessage[],
): Promise<ModelMessage[]> {
  const lastIndex = messages.length - 1;
  const prepared = messages.map((message, index) =>
    index < lastIndex ? withStaleProposalsDenied(message) : message,
  );
  return convertToModelMessages(prepared, { ignoreIncompleteToolCalls: true });
}

export function createOnboardingTools({ db }: { db: PrismaClient }) {
  return {
    addAccounts: tool({
      description:
        "Propose bank accounts to add. The user reviews the list and must approve it before anything is created. Names that already exist are skipped.",
      inputSchema: addAccountsInputSchema,
      needsApproval: true,
      execute: ({ accounts }) => createAccounts(db, accounts),
    }),
    addCategories: tool({
      description:
        "Propose categories to add, each with a kind (EXPENSE, INCOME, or TRANSFER) and an optional short classifier hint for the AI categorizer. The user must approve the list before anything is created. Names that already exist are skipped.",
      inputSchema: addCategoriesInputSchema,
      needsApproval: true,
      execute: ({ categories }) => createCategories(db, categories),
    }),
  };
}
