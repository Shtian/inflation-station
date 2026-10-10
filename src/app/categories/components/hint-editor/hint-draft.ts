import type {
  CategoryMerchantHistory,
  HistoryMerchant,
} from "@/lib/categorization/category-merchants";
import type { HintGuess } from "@/lib/categorization/hint-guess";
import {
  applyMerchantChip,
  formatJevCategoryLine,
  HINT_SOFT_LIMIT,
  type HintMerchant,
  hasLeadingDescription,
  type MerchantPresence,
  merchantPresence,
  namesAnyMerchant,
  setLeadingDescription,
  suggestHintText,
} from "@/lib/categorization/hint-text";
import type { HintGuessUnavailableReason } from "./fetch-hint-guess";

const VISIBLE_CHIP_COUNT = 6;

export type SavedHintVerdict =
  | { kind: "empty" }
  | { kind: "names-history" }
  | { kind: "names-none"; decision: "pending" | "kept" | "replaced" }
  // A saved hint over zero transactions: "none appear in the 0 transactions"
  // would be nonsense, so there is no mismatch to judge.
  | { kind: "unjudged" };

export type HistorySlot =
  | { status: "loading" }
  | { status: "failed" }
  | {
      status: "loaded";
      history: CategoryMerchantHistory;
      verdict: SavedHintVerdict;
    };

export type GuessSlot =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "unavailable"; reason: HintGuessUnavailableReason }
  | { status: "loaded"; guess: HintGuess };

export type HintDraft = {
  categoryId: string;
  saved: string;
  text: string;
  // The text the reducer last wrote, or null when it has no claim. The reducer
  // only rewrites `text` while it still equals this, so neither arrival order
  // can clobber anything the user typed or clicked.
  autoText: string | null;
  history: HistorySlot;
  guess: GuessSlot;
  showAllMerchants: boolean;
  panelOpen: boolean;
  note: string | null;
};

export type HintDraftAction =
  | {
      type: "history-loaded";
      categoryId: string;
      history: CategoryMerchantHistory;
    }
  | { type: "history-unavailable"; categoryId: string }
  | { type: "guess-requested"; categoryId: string }
  | { type: "guess-loaded"; categoryId: string; guess: HintGuess }
  | {
      type: "guess-unavailable";
      categoryId: string;
      reason: HintGuessUnavailableReason;
    }
  | { type: "text-edited"; text: string }
  | { type: "chip-clicked"; merchant: HintMerchant }
  | { type: "description-set"; on: boolean }
  | { type: "replace-with-suggestion" }
  | { type: "keep-saved" }
  | { type: "open-panel" }
  | { type: "show-all-merchants" };

export type HintChip<M extends HintMerchant = HistoryMerchant> = {
  merchant: M;
  presence: MerchantPresence;
};

export type HintDraftView = {
  badge: "suggested" | null;
  mismatch: { savedText: string; transactionCount: number } | null;
  jevLine: string;
  length: number;
  overBudget: boolean;
  suggestions:
    | { kind: "hidden" }
    | { kind: "collapsed"; transactionCount: number }
    | {
        kind: "expanded";
        description: { text: string; checked: boolean } | null;
        history: { chips: HintChip[]; hiddenCount: number } | null;
        guesses: HintChip<HintMerchant>[];
        // null once the guess has loaded: its description row and guess
        // group take the place of the AI row.
        ai:
          | { kind: "suggest" }
          | { kind: "pending" }
          | { kind: "unavailable"; reason: HintGuessUnavailableReason }
          | null;
        note: string | null;
      };
};

export function openHintDraft(category: {
  id: string;
  classifierHint: string | null;
}): HintDraft {
  const saved = category.classifierHint ?? "";
  return {
    categoryId: category.id,
    saved,
    text: saved,
    autoText: saved.trim() === "" ? saved : null,
    history: { status: "loading" },
    guess: { status: "idle" },
    showAllMerchants: false,
    panelOpen: false,
    note: null,
  };
}

export function hintDraftPayload(draft: HintDraft): string | null {
  return draft.text.trim() || null;
}

export function reduceHintDraft(
  draft: HintDraft,
  action: HintDraftAction,
): HintDraft {
  switch (action.type) {
    case "history-loaded": {
      if (
        action.categoryId !== draft.categoryId ||
        draft.history.status !== "loading"
      ) {
        return draft;
      }
      const { merchants } = action.history;
      const verdict: SavedHintVerdict =
        merchants.length === 0 && draft.saved.trim() !== ""
          ? { kind: "unjudged" }
          : judgeSavedHint(draft.saved, merchants);
      return settle({
        ...draft,
        history: { status: "loaded", history: action.history, verdict },
      });
    }
    case "history-unavailable":
      return action.categoryId !== draft.categoryId ||
        draft.history.status !== "loading"
        ? draft
        : { ...draft, history: { status: "failed" } };
    case "guess-requested": {
      const { guess } = draft;
      const requestable =
        guess.status === "idle" ||
        (guess.status === "unavailable" && guess.reason === "failed");
      return action.categoryId !== draft.categoryId || !requestable
        ? draft
        : { ...draft, guess: { status: "loading" } };
    }
    case "guess-loaded":
      return action.categoryId !== draft.categoryId ||
        draft.guess.status !== "loading"
        ? draft
        : settle({
            ...draft,
            guess: { status: "loaded", guess: action.guess },
          });
    case "guess-unavailable":
      return action.categoryId !== draft.categoryId ||
        draft.guess.status !== "loading"
        ? draft
        : {
            ...draft,
            guess: { status: "unavailable", reason: action.reason },
          };
    case "text-edited":
      return { ...draft, text: action.text, note: null };
    case "chip-clicked": {
      const result = applyMerchantChip(draft.text, action.merchant);
      return result.kind === "text"
        ? { ...draft, text: result.text, note: null }
        : { ...draft, note: result.message };
    }
    case "description-set": {
      const description = loadedDescription(draft);
      if (description === null) {
        return draft;
      }
      const text = setLeadingDescription(draft.text, description, action.on);
      return text === draft.text ? draft : { ...draft, text, note: null };
    }
    case "replace-with-suggestion":
    case "keep-saved": {
      const { history } = draft;
      if (
        history.status !== "loaded" ||
        history.verdict.kind !== "names-none" ||
        history.verdict.decision !== "pending"
      ) {
        return draft;
      }
      const replace = action.type === "replace-with-suggestion";
      const suggestion = suggestHintText(
        history.history.merchants,
        loadedDescription(draft),
      );
      return {
        ...draft,
        text: replace ? suggestion : draft.text,
        autoText: replace ? suggestion : draft.autoText,
        note: null,
        history: {
          ...history,
          verdict: {
            kind: "names-none",
            decision: replace ? "replaced" : "kept",
          },
        },
      };
    }
    case "open-panel":
      return { ...draft, panelOpen: true };
    case "show-all-merchants":
      return { ...draft, showAllMerchants: true };
  }
}

function settle(draft: HintDraft): HintDraft {
  if (
    draft.history.status !== "loaded" ||
    draft.autoText === null ||
    draft.text !== draft.autoText
  ) {
    return draft;
  }
  const suggestion = suggestHintText(
    draft.history.history.merchants,
    loadedDescription(draft),
  );
  return { ...draft, text: suggestion, autoText: suggestion };
}

function loadedDescription(draft: HintDraft): string | null {
  return draft.guess.status === "loaded" ? draft.guess.guess.description : null;
}

function judgeSavedHint(
  saved: string,
  merchants: readonly HistoryMerchant[],
): SavedHintVerdict {
  if (saved.trim() === "") {
    return { kind: "empty" };
  }
  return namesAnyMerchant(saved, merchants)
    ? { kind: "names-history" }
    : { kind: "names-none", decision: "pending" };
}

export function viewHintDraft(
  draft: HintDraft,
  categoryName: string,
): HintDraftView {
  const jevLine = formatJevCategoryLine(
    categoryName.trim(),
    hintDraftPayload(draft),
  );
  const view = {
    jevLine,
    length: jevLine.length,
    overBudget: jevLine.length > HINT_SOFT_LIMIT,
  };

  const { history } = draft;
  const guess = draft.guess.status === "loaded" ? draft.guess.guess : null;
  if (history.status !== "loaded") {
    return {
      ...view,
      badge: null,
      mismatch: null,
      suggestions: { kind: "hidden" },
    };
  }

  const { merchants } = history.history;
  const { verdict } = history;
  const { transactionCount } = history.history;
  const pending =
    verdict.kind === "names-none" && verdict.decision === "pending";
  const collapsed =
    !draft.panelOpen &&
    (verdict.kind === "names-history" ||
      (verdict.kind === "names-none" && verdict.decision === "kept"));
  const visible = draft.showAllMerchants
    ? merchants
    : merchants.slice(0, VISIBLE_CHIP_COUNT);
  const chip = <M extends HintMerchant>(merchant: M): HintChip<M> => ({
    merchant,
    presence: merchantPresence(draft.text, merchant),
  });

  return {
    ...view,
    badge:
      draft.autoText !== null &&
      draft.text === draft.autoText &&
      draft.text !== draft.saved
        ? "suggested"
        : null,
    mismatch: pending ? { savedText: draft.saved, transactionCount } : null,
    suggestions: collapsed
      ? { kind: "collapsed", transactionCount }
      : {
          kind: "expanded",
          description: guess?.description
            ? {
                text: guess.description,
                checked: hasLeadingDescription(draft.text, guess.description),
              }
            : null,
          history:
            merchants.length > 0
              ? {
                  chips: visible.map(chip),
                  hiddenCount: merchants.length - visible.length,
                }
              : null,
          guesses: guess?.merchants.map(chip) ?? [],
          ai: aiRow(draft.guess),
          note: draft.note,
        },
  };
}

function aiRow(
  guess: GuessSlot,
): Extract<HintDraftView["suggestions"], { kind: "expanded" }>["ai"] {
  switch (guess.status) {
    case "idle":
      return { kind: "suggest" };
    case "loading":
      return { kind: "pending" };
    case "unavailable":
      return { kind: "unavailable", reason: guess.reason };
    case "loaded":
      return null;
  }
}
