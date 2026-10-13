import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createTestDatabase,
  type TestDatabase,
  teardownTestDatabase,
} from "../../../tests/support/prisma-test-db";
import {
  buildOnboardingSystemPrompt,
  createOnboardingTools,
  resolveOnboardingDisabledReason,
  toModelMessages,
} from "./agent";
import type { OnboardingUIMessage } from "./contract";

describe("resolveOnboardingDisabledReason", () => {
  it("is enabled with a key and key_missing with a blank one", () => {
    expect(resolveOnboardingDisabledReason({ OPENAI_API_KEY: "sk-test" })).toBe(
      null,
    );
    expect(resolveOnboardingDisabledReason({ OPENAI_API_KEY: "  " })).toBe(
      "key_missing",
    );
  });
});

describe("buildOnboardingSystemPrompt", () => {
  it("marks step progress and lists what already exists", () => {
    const prompt = buildOnboardingSystemPrompt({
      accounts: [
        { name: "Brukskonto", institution: "DNB" },
        { name: "Kontanter", institution: null },
      ],
      categories: [
        {
          name: "Dagligvarer",
          kind: "EXPENSE",
          classifierHint: "Rema, Kiwi",
        },
      ],
    });

    expect(prompt).toContain("1. Legg til kontoene dine (done):");
    expect(prompt).toContain("2. Opprett kategorier (done):");
    expect(prompt).toContain("3. Skjul overføringer (current):");
    expect(prompt).toContain('The current step is "Skjul overføringer".');
    expect(prompt).toContain(
      "Existing accounts:\n- Brukskonto (DNB)\n- Kontanter\n",
    );
    expect(prompt).toContain(
      "Existing categories:\n- Dagligvarer [EXPENSE] hint: Rema, Kiwi",
    );
  });

  it("starts an empty setup at the accounts step", () => {
    const prompt = buildOnboardingSystemPrompt({
      accounts: [],
      categories: [],
    });

    expect(prompt).toContain("1. Legg til kontoene dine (current):");
    expect(prompt).toContain("2. Opprett kategorier (upcoming):");
    expect(prompt).toContain(
      "Existing accounts:\n- none yet\n\nExisting categories:\n- none yet",
    );
  });
});

describe("toModelMessages", () => {
  it("sends a proposal the user replied to instead of approving as denied", async () => {
    const proposal = {
      categories: [{ name: "Mat", kind: "EXPENSE" as const }],
    };
    const messages = await toModelMessages([
      { id: "u1", role: "user", parts: [{ type: "text", text: "Hei" }] },
      {
        id: "a1",
        role: "assistant",
        parts: [
          {
            type: "tool-addCategories",
            toolCallId: "call-1",
            state: "approval-requested",
            input: proposal,
            approval: { id: "approval-1" },
          },
        ],
      },
      {
        id: "u2",
        role: "user",
        parts: [{ type: "text", text: "Kall den Dagligvarer" }],
      },
    ] satisfies OnboardingUIMessage[]);

    expect(messages[2]).toEqual({
      role: "tool",
      content: [
        {
          type: "tool-approval-response",
          approvalId: "approval-1",
          approved: false,
          reason:
            "The user replied in the chat instead of approving this proposal.",
        },
        {
          type: "tool-result",
          toolCallId: "call-1",
          toolName: "addCategories",
          output: {
            type: "error-text",
            value:
              "The user replied in the chat instead of approving this proposal.",
          },
        },
      ],
    });
  });
});

describe("createOnboardingTools", () => {
  let testDb: TestDatabase;

  beforeEach(async () => {
    testDb = await createTestDatabase();
  });

  afterEach(async () => {
    await teardownTestDatabase(testDb);
  });

  it("adds accounts and reports the ones that already existed", async () => {
    await testDb.client.account.create({ data: { name: "Brukskonto" } });
    const tools = createOnboardingTools({ db: testDb.client });

    const result = await tools.addAccounts.execute?.(
      {
        accounts: [
          { name: "brukskonto", institution: "DNB" },
          { name: "Sparekonto", institution: "DNB" },
        ],
      },
      { toolCallId: "call-1", messages: [] },
    );

    expect(result).toEqual({
      created: ["Sparekonto"],
      existing: ["Brukskonto"],
    });
  });
});
