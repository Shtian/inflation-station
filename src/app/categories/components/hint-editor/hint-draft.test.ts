import { describe, expect, it } from "vitest";
import type { CategoryMerchantHistory } from "@/lib/categorization/category-merchants";
import {
  type HintDraft,
  type HintDraftAction,
  hintDraftPayload,
  openHintDraft,
  reduceHintDraft,
  viewHintDraft,
} from "./hint-draft";

const groceriesHistory: CategoryMerchantHistory = {
  transactionCount: 73,
  merchants: [
    { key: "rema", label: "Rema", transactionCount: 41 },
    { key: "kiwi", label: "Kiwi", transactionCount: 23 },
    { key: "meny", label: "Meny", transactionCount: 9 },
  ],
};

const transportHistory: CategoryMerchantHistory = {
  transactionCount: 12,
  merchants: [
    { key: "ruter", label: "Ruter", transactionCount: 6 },
    { key: "bolt", label: "Bolt", transactionCount: 4 },
    { key: "uber", label: "Uber", transactionCount: 2 },
  ],
};

const subscriptionsHistory: CategoryMerchantHistory = {
  transactionCount: 28,
  merchants: [
    { key: "netflix", label: "Netflix", transactionCount: 12 },
    { key: "spotify", label: "Spotify", transactionCount: 12 },
    { key: "viaplay", label: "Viaplay", transactionCount: 4 },
  ],
};

function run(draft: HintDraft, ...actions: HintDraftAction[]): HintDraft {
  return actions.reduce(reduceHintDraft, draft);
}

function loaded(
  classifierHint: string | null,
  history: CategoryMerchantHistory,
): HintDraft {
  return run(openHintDraft({ id: "cat-1", classifierHint }), {
    type: "history-loaded",
    categoryId: "cat-1",
    history,
  });
}

describe("hint draft", () => {
  it("renders like a plain textarea until history arrives", () => {
    const draft = openHintDraft({ id: "cat-1", classifierHint: "Kiwi" });

    expect(viewHintDraft(draft, "Groceries")).toEqual({
      badge: null,
      mismatch: null,
      jevLine: "Groceries: Kiwi",
      length: 15,
      overBudget: false,
      suggestions: { kind: "hidden" },
    });
  });

  it("prefills an empty hint with the top history merchants and marks it suggested", () => {
    const draft = loaded(null, groceriesHistory);
    const view = viewHintDraft(draft, "Groceries");

    expect(draft.text).toBe("Rema, Kiwi, Meny");
    expect(view.badge).toBe("suggested");
    expect(view.jevLine).toBe("Groceries: Rema, Kiwi, Meny");
    expect(view.suggestions).toEqual({
      kind: "expanded",
      chips: [
        { merchant: groceriesHistory.merchants[0], presence: "on" },
        { merchant: groceriesHistory.merchants[1], presence: "on" },
        { merchant: groceriesHistory.merchants[2], presence: "on" },
      ],
      hiddenCount: 0,
      note: null,
    });
    expect(hintDraftPayload(draft)).toBe("Rema, Kiwi, Meny");
  });

  it("drops the suggested badge once a chip changes the text", () => {
    const draft = run(loaded(null, groceriesHistory), {
      type: "chip-clicked",
      merchant: groceriesHistory.merchants[1],
    });

    expect(draft.text).toBe("Rema, Meny");
    expect(viewHintDraft(draft, "Groceries").badge).toBeNull();
  });

  it("keeps text typed before history arrived", () => {
    const draft = run(
      openHintDraft({ id: "cat-1", classifierHint: null }),
      { type: "text-edited", text: "Coop" },
      {
        type: "history-loaded",
        categoryId: "cat-1",
        history: groceriesHistory,
      },
    );

    expect(draft.text).toBe("Coop");
    expect(viewHintDraft(draft, "Groceries").badge).toBeNull();
  });

  it("collapses suggestions behind a toggle when the saved hint names history", () => {
    const draft = loaded(
      "Ruter, Vy, Bolt (not Bolt Food), taxi",
      transportHistory,
    );

    expect(viewHintDraft(draft, "Transport")).toMatchObject({
      badge: null,
      mismatch: null,
      suggestions: { kind: "collapsed", transactionCount: 12 },
    });

    const opened = run(draft, { type: "open-panel" });
    expect(viewHintDraft(opened, "Transport").suggestions).toEqual({
      kind: "expanded",
      chips: [
        { merchant: transportHistory.merchants[0], presence: "on" },
        { merchant: transportHistory.merchants[1], presence: "mentioned" },
        { merchant: transportHistory.merchants[2], presence: "off" },
      ],
      hiddenCount: 0,
      note: null,
    });
  });

  it("notes a chip inside the user's wording and clears the note on the next edit", () => {
    const draft = run(
      loaded("Ruter, Vy, Bolt (not Bolt Food), taxi", transportHistory),
      { type: "open-panel" },
      { type: "chip-clicked", merchant: transportHistory.merchants[1] },
    );

    expect(draft.text).toBe("Ruter, Vy, Bolt (not Bolt Food), taxi");
    expect(draft.note).toBe(
      "“Bolt” is part of your own wording. Edit the text to change it.",
    );
    expect(run(draft, { type: "text-edited", text: "Ruter" }).note).toBeNull();
  });

  it("flags a saved hint that names no history merchant and offers the suggestion", () => {
    const draft = loaded("Rema 1000, Meny, Kiwi", subscriptionsHistory);
    const view = viewHintDraft(draft, "Abonnementer");

    expect(view.mismatch).toEqual({
      savedText: "Rema 1000, Meny, Kiwi",
      transactionCount: 28,
    });
    expect(view.suggestions.kind).toBe("expanded");
    expect(draft.text).toBe("Rema 1000, Meny, Kiwi");
  });

  it("replaces a mismatched hint with the suggestion", () => {
    const draft = run(loaded("Rema 1000, Meny, Kiwi", subscriptionsHistory), {
      type: "replace-with-suggestion",
    });
    const view = viewHintDraft(draft, "Abonnementer");

    expect(draft.text).toBe("Netflix, Spotify, Viaplay");
    expect(view.badge).toBe("suggested");
    expect(view.mismatch).toBeNull();
    expect(view.suggestions.kind).toBe("expanded");
    expect(hintDraftPayload(draft)).toBe("Netflix, Spotify, Viaplay");
  });

  it("keeps a mismatched hint and collapses the suggestions", () => {
    const draft = run(loaded("Rema 1000, Meny, Kiwi", subscriptionsHistory), {
      type: "keep-saved",
    });

    expect(draft.text).toBe("Rema 1000, Meny, Kiwi");
    expect(viewHintDraft(draft, "Abonnementer")).toMatchObject({
      mismatch: null,
      suggestions: { kind: "collapsed", transactionCount: 28 },
    });
    expect(hintDraftPayload(draft)).toBe("Rema 1000, Meny, Kiwi");
  });

  it("ignores history for a category other than the open one", () => {
    const draft = openHintDraft({ id: "cat-1", classifierHint: null });

    expect(
      reduceHintDraft(draft, {
        type: "history-loaded",
        categoryId: "cat-2",
        history: groceriesHistory,
      }),
    ).toBe(draft);
    expect(
      reduceHintDraft(draft, {
        type: "history-unavailable",
        categoryId: "cat-2",
      }),
    ).toBe(draft);
  });

  it("behaves like a plain textarea when history is unavailable or empty", () => {
    const failed = run(openHintDraft({ id: "cat-1", classifierHint: null }), {
      type: "history-unavailable",
      categoryId: "cat-1",
    });
    const empty = loaded(null, { transactionCount: 0, merchants: [] });

    for (const draft of [failed, empty]) {
      expect(draft.text).toBe("");
      expect(draft.history).toEqual({ status: "unavailable" });
      expect(viewHintDraft(draft, "Groceries").suggestions).toEqual({
        kind: "hidden",
      });
    }
  });

  it("flags the Jev line over budget past 200 characters", () => {
    const at = (hint: string) =>
      viewHintDraft(
        openHintDraft({ id: "cat-1", classifierHint: hint }),
        "Groceries",
      );

    expect(at("x".repeat(189))).toMatchObject({
      length: 200,
      overBudget: false,
    });
    expect(at("x".repeat(190))).toMatchObject({
      length: 201,
      overBudget: true,
    });
  });

  it("shows six chips and counts the rest until asked for all", () => {
    const merchants = Array.from({ length: 18 }, (_, index) => ({
      key: `shop${String.fromCharCode(97 + index)}`,
      label: `Shop${String.fromCharCode(97 + index)}`,
      transactionCount: 18 - index,
    }));
    const draft = loaded(null, { transactionCount: 171, merchants });
    const view = viewHintDraft(draft, "Shopping");

    expect(view.suggestions).toMatchObject({
      kind: "expanded",
      hiddenCount: 12,
    });
    expect(
      view.suggestions.kind === "expanded" &&
        view.suggestions.chips.map((chip) => chip.merchant.label),
    ).toEqual(["Shopa", "Shopb", "Shopc", "Shopd", "Shope", "Shopf"]);

    const all = viewHintDraft(
      run(draft, { type: "show-all-merchants" }),
      "Shopping",
    );
    expect(all.suggestions).toMatchObject({ kind: "expanded", hiddenCount: 0 });
    expect(
      all.suggestions.kind === "expanded" && all.suggestions.chips,
    ).toHaveLength(18);
  });
});
