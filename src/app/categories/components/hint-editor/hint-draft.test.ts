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
      description: null,
      history: {
        chips: [
          { merchant: groceriesHistory.merchants[0], presence: "on" },
          { merchant: groceriesHistory.merchants[1], presence: "on" },
          { merchant: groceriesHistory.merchants[2], presence: "on" },
        ],
        hiddenCount: 0,
      },
      guesses: [],
      ai: { kind: "suggest" },
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
      description: null,
      history: {
        chips: [
          { merchant: transportHistory.merchants[0], presence: "on" },
          { merchant: transportHistory.merchants[1], presence: "mentioned" },
          { merchant: transportHistory.merchants[2], presence: "off" },
        ],
        hiddenCount: 0,
      },
      guesses: [],
      ai: { kind: "suggest" },
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

  it("behaves like a plain textarea when history is unavailable", () => {
    const failed = run(openHintDraft({ id: "cat-1", classifierHint: null }), {
      type: "history-unavailable",
      categoryId: "cat-1",
    });

    expect(failed.history).toEqual({ status: "failed" });
    expect(failed.text).toBe("");
    expect(viewHintDraft(failed, "Groceries").suggestions).toEqual({
      kind: "hidden",
    });
  });

  it("offers only the AI button for a category with no history", () => {
    const empty = loaded(null, { transactionCount: 0, merchants: [] });

    expect(empty.history).toEqual({
      status: "loaded",
      history: { transactionCount: 0, merchants: [] },
      verdict: { kind: "empty" },
    });
    expect(empty.text).toBe("");
    expect(viewHintDraft(empty, "Groceries")).toEqual({
      badge: null,
      mismatch: null,
      jevLine: "Groceries",
      length: 9,
      overBudget: false,
      suggestions: {
        kind: "expanded",
        description: null,
        history: null,
        guesses: [],
        ai: { kind: "suggest" },
        note: null,
      },
    });
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
      history: { hiddenCount: 12 },
    });
    expect(
      view.suggestions.kind === "expanded" &&
        view.suggestions.history?.chips.map((chip) => chip.merchant.label),
    ).toEqual(["Shopa", "Shopb", "Shopc", "Shopd", "Shope", "Shopf"]);

    const all = viewHintDraft(
      run(draft, { type: "show-all-merchants" }),
      "Shopping",
    );
    expect(all.suggestions).toMatchObject({
      kind: "expanded",
      history: { hiddenCount: 0 },
    });
    expect(
      all.suggestions.kind === "expanded" && all.suggestions.history?.chips,
    ).toHaveLength(18);
  });
});

describe("hint draft with a guess", () => {
  const d = "Groceries and food shopping";
  const bunnpris = { key: "bunnpris", label: "Bunnpris" };
  const joker = { key: "joker", label: "Joker" };
  const guess = { description: d, merchants: [bunnpris, joker] };
  const emptyHistory: CategoryMerchantHistory = {
    transactionCount: 0,
    merchants: [],
  };
  const suggested = "Groceries and food shopping. Rema, Kiwi, Meny";

  const H: HintDraftAction = {
    type: "history-loaded",
    categoryId: "g",
    history: groceriesHistory,
  };
  const H0: HintDraftAction = {
    type: "history-loaded",
    categoryId: "g",
    history: emptyHistory,
  };
  const R: HintDraftAction = { type: "guess-requested", categoryId: "g" };
  const G: HintDraftAction = { type: "guess-loaded", categoryId: "g", guess };
  const noGuess: HintDraftAction = {
    type: "guess-unavailable",
    categoryId: "g",
    reason: "disabled",
  };
  const failedGuess: HintDraftAction = {
    type: "guess-unavailable",
    categoryId: "g",
    reason: "failed",
  };
  const typed = (text: string): HintDraftAction => ({
    type: "text-edited",
    text,
  });
  const open = (classifierHint: string | null = null) =>
    openHintDraft({ id: "g", classifierHint });
  const expanded = (draft: HintDraft) => {
    const { suggestions } = viewHintDraft(draft, "Groceries");
    if (suggestions.kind !== "expanded") {
      throw new Error(`expected expanded suggestions, got ${suggestions.kind}`);
    }
    return suggestions;
  };

  describe("async ordering", () => {
    it("prefills history alone without a description row", () => {
      const draft = run(open(), H);

      expect(draft.text).toBe("Rema, Kiwi, Meny");
      expect(viewHintDraft(draft, "Groceries").badge).toBe("suggested");
      expect(expanded(draft).description).toBeNull();
    });

    it("adds the description to an untouched prefill when the guess arrives", () => {
      const draft = run(open(), H, R, G);

      expect(draft.text).toBe(suggested);
      expect(viewHintDraft(draft, "Groceries").badge).toBe("suggested");
      expect(expanded(draft)).toMatchObject({
        description: { text: d, checked: true },
        guesses: [
          { merchant: bunnpris, presence: "off" },
          { merchant: joker, presence: "off" },
        ],
        ai: null,
      });
    });

    it("waits for history before writing anything", () => {
      const draft = run(open(), R, G);

      expect(draft.text).toBe("");
      expect(viewHintDraft(draft, "Groceries").suggestions).toEqual({
        kind: "hidden",
      });
    });

    it("ends in the same draft whichever slot arrives first", () => {
      expect(run(open(), R, G, H)).toEqual(run(open(), H, R, G));
    });

    it("never overwrites typed text", () => {
      const draft = run(open(), H, R, typed("Rema, Kiwi, Meny, Coop"), G);

      expect(draft.text).toBe("Rema, Kiwi, Meny, Coop");
      expect(expanded(draft).description).toEqual({ text: d, checked: false });
      expect(viewHintDraft(draft, "Groceries").badge).toBeNull();
    });

    it("treats a chip click as a user edit", () => {
      const draft = run(
        open(),
        H,
        {
          type: "chip-clicked",
          merchant: groceriesHistory.merchants[1],
        },
        R,
        G,
      );

      expect(draft.text).toBe("Rema, Meny");
    });

    it("keeps a cleared box cleared", () => {
      expect(run(open(), H, typed(""), R, G).text).toBe("");
    });

    it("removes and restores the description with the checkbox", () => {
      const unchecked = run(open(), H, R, G, {
        type: "description-set",
        on: false,
      });

      expect(unchecked.text).toBe("Rema, Kiwi, Meny");
      expect(viewHintDraft(unchecked, "Groceries").badge).toBeNull();

      const checked = run(unchecked, { type: "description-set", on: true });
      expect(checked.text).toBe(suggested);
      expect(viewHintDraft(checked, "Groceries").badge).toBe("suggested");
      expect(
        reduceHintDraft(checked, { type: "description-set", on: true }),
      ).toBe(checked);
    });

    it("replaces a mismatched hint with the description-led suggestion", () => {
      const draft = run(open("Coop Extra"), H, R, G);

      expect(draft.text).toBe("Coop Extra");
      expect(viewHintDraft(draft, "Groceries").mismatch).toEqual({
        savedText: "Coop Extra",
        transactionCount: 73,
      });
      expect(run(draft, { type: "replace-with-suggestion" }).text).toBe(
        suggested,
      );
    });

    it("upgrades an untouched replacement when the guess arrives", () => {
      expect(
        run(open("Coop Extra"), H, { type: "replace-with-suggestion" }, R, G)
          .text,
      ).toBe(suggested);
    });

    it("leaves an edited replacement alone when the guess arrives", () => {
      expect(
        run(
          open("Coop Extra"),
          H,
          { type: "replace-with-suggestion" },
          typed("Rema"),
          R,
          G,
        ).text,
      ).toBe("Rema");
    });

    it("never writes after the saved hint is kept", () => {
      const draft = run(open("Coop Extra"), H, { type: "keep-saved" }, R, G);

      expect(draft.text).toBe("Coop Extra");
      expect(viewHintDraft(draft, "Groceries").suggestions).toEqual({
        kind: "collapsed",
        transactionCount: 73,
      });
    });

    it("keeps a good saved hint collapsed and unchecked", () => {
      const draft = run(open("Rema"), H, R, G);

      expect(draft.text).toBe("Rema");
      expect(viewHintDraft(draft, "Groceries").suggestions).toEqual({
        kind: "collapsed",
        transactionCount: 73,
      });
      expect(expanded(run(draft, { type: "open-panel" })).description).toEqual({
        text: d,
        checked: false,
      });
    });

    it("ignores a stale or repeated guess", () => {
      const draft = run(open(), H);

      expect(
        reduceHintDraft(draft, {
          type: "guess-loaded",
          categoryId: "other",
          guess,
        }),
      ).toBe(draft);
      expect(reduceHintDraft(draft, G)).toBe(draft);
      const requested = run(draft, R);
      expect(
        reduceHintDraft(requested, {
          type: "guess-loaded",
          categoryId: "other",
          guess,
        }),
      ).toBe(requested);
      const withGuess = run(requested, G);
      expect(reduceHintDraft(withGuess, G)).toBe(withGuess);
      expect(reduceHintDraft(withGuess, noGuess)).toBe(withGuess);
      expect(reduceHintDraft(withGuess, R)).toBe(withGuess);
    });
  });

  describe("on request", () => {
    it("writes nothing from a guess nobody asked for", () => {
      const draft = run(open(), H);

      expect(draft.guess).toEqual({ status: "idle" });
      expect(reduceHintDraft(draft, G)).toBe(draft);
      expect(reduceHintDraft(draft, noGuess)).toBe(draft);
      expect(draft.text).toBe("Rema, Kiwi, Meny");
      expect(expanded(draft).ai).toEqual({ kind: "suggest" });
    });

    it("starts loading on the first request and ignores repeats", () => {
      const draft = run(open(), H);
      const requested = run(draft, R);

      expect(requested.guess).toEqual({ status: "loading" });
      expect(expanded(requested).ai).toEqual({ kind: "pending" });
      expect(reduceHintDraft(requested, R)).toBe(requested);
      expect(
        reduceHintDraft(draft, {
          type: "guess-requested",
          categoryId: "other",
        }),
      ).toBe(draft);
    });

    it("allows a retry after a failed guess", () => {
      const failed = run(open(), H, R, failedGuess);

      expect(failed.guess).toEqual({ status: "unavailable", reason: "failed" });
      expect(expanded(failed).ai).toEqual({
        kind: "unavailable",
        reason: "failed",
      });

      const retried = run(failed, R);
      expect(retried.guess).toEqual({ status: "loading" });
      expect(run(retried, G).text).toBe(suggested);
    });

    it("does not retry when AI suggestions are off or unconfigured", () => {
      const disabled = run(open(), H, R, noGuess);
      const keyMissing = run(open(), H, R, {
        type: "guess-unavailable",
        categoryId: "g",
        reason: "key_missing",
      });

      expect(expanded(disabled).ai).toEqual({
        kind: "unavailable",
        reason: "disabled",
      });
      expect(expanded(keyMissing).ai).toEqual({
        kind: "unavailable",
        reason: "key_missing",
      });
      expect(reduceHintDraft(disabled, R)).toBe(disabled);
      expect(reduceHintDraft(keyMissing, R)).toBe(keyMissing);
    });
  });

  describe("degrades to PR 1", () => {
    it("shows the history panel alone when no guess is available", () => {
      const draft = run(open(), H, R, noGuess);

      expect(draft.text).toBe("Rema, Kiwi, Meny");
      expect(viewHintDraft(draft, "Groceries")).toEqual({
        badge: "suggested",
        mismatch: null,
        jevLine: "Groceries: Rema, Kiwi, Meny",
        length: 27,
        overBudget: false,
        suggestions: {
          kind: "expanded",
          description: null,
          history: {
            chips: [
              { merchant: groceriesHistory.merchants[0], presence: "on" },
              { merchant: groceriesHistory.merchants[1], presence: "on" },
              { merchant: groceriesHistory.merchants[2], presence: "on" },
            ],
            hiddenCount: 0,
          },
          guesses: [],
          ai: { kind: "unavailable", reason: "disabled" },
          note: null,
        },
      });
    });

    it("stays hidden when history failed, whatever the guess says", () => {
      const draft = run(
        open(),
        { type: "history-unavailable", categoryId: "g" },
        R,
        G,
      );

      expect(draft.text).toBe("");
      expect(viewHintDraft(draft, "Groceries").suggestions).toEqual({
        kind: "hidden",
      });
    });

    it("ignores the checkbox until a description has loaded", () => {
      const idle = run(open(), H);
      const loading = run(idle, R);
      const unavailable = run(loading, noGuess);

      for (const draft of [idle, loading, unavailable]) {
        expect(
          reduceHintDraft(draft, { type: "description-set", on: true }),
        ).toBe(draft);
      }
    });
  });

  describe("empty history", () => {
    it("prefills the description alone and shows the guesses", () => {
      const draft = run(open(), H0, R, G);

      expect(draft.text).toBe("Groceries and food shopping.");
      expect(viewHintDraft(draft, "Groceries").badge).toBe("suggested");
      expect(expanded(draft)).toEqual({
        kind: "expanded",
        description: { text: d, checked: true },
        history: null,
        guesses: [
          { merchant: bunnpris, presence: "off" },
          { merchant: joker, presence: "off" },
        ],
        ai: null,
        note: null,
      });
    });

    it("appends a guessed merchant after the description", () => {
      const draft = run(open(), H0, R, G, {
        type: "chip-clicked",
        merchant: joker,
      });

      expect(draft.text).toBe("Groceries and food shopping. Joker");
      expect(expanded(draft).guesses).toEqual([
        { merchant: bunnpris, presence: "off" },
        { merchant: joker, presence: "on" },
      ]);
    });

    it("explains why there is no guess", () => {
      const draft = run(open(), H0, R, noGuess);

      expect(draft.text).toBe("");
      expect(expanded(draft)).toEqual({
        kind: "expanded",
        description: null,
        history: null,
        guesses: [],
        ai: { kind: "unavailable", reason: "disabled" },
        note: null,
      });
    });

    it("does not judge a saved hint against zero transactions", () => {
      const draft = run(open("Taxi rides"), H0, R, G);

      expect(draft.history).toMatchObject({ verdict: { kind: "unjudged" } });
      expect(draft.text).toBe("Taxi rides");
      expect(viewHintDraft(draft, "Groceries").mismatch).toBeNull();
      expect(expanded(draft).description).toEqual({ text: d, checked: false });
    });
  });
});
