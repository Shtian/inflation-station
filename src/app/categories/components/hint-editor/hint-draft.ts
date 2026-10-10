import type {
  CategoryMerchantHistory,
  HistoryMerchant,
} from "@/lib/categorization/category-merchants";
import {
  applyMerchantChip,
  formatJevCategoryLine,
  HINT_SOFT_LIMIT,
  type MerchantPresence,
  merchantPresence,
  namesAnyMerchant,
  suggestHintText,
} from "@/lib/categorization/hint-text";

const VISIBLE_CHIP_COUNT = 6;

export type SavedHintVerdict =
  | { kind: "empty" }
  | { kind: "names-history" }
  | { kind: "names-none"; decision: "pending" | "kept" | "replaced" };

export type HistorySlot =
  | { status: "loading" }
  | { status: "unavailable" }
  | {
      status: "loaded";
      history: CategoryMerchantHistory;
      verdict: SavedHintVerdict;
      suggestedText: string;
    };

export type HintDraft = {
  categoryId: string;
  saved: string;
  text: string;
  history: HistorySlot;
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
  | { type: "text-edited"; text: string }
  | { type: "chip-clicked"; merchant: HistoryMerchant }
  | { type: "replace-with-suggestion" }
  | { type: "keep-saved" }
  | { type: "open-panel" }
  | { type: "show-all-merchants" };

export type HintChip = {
  merchant: HistoryMerchant;
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
        chips: HintChip[];
        hiddenCount: number;
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
    history: { status: "loading" },
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
      if (merchants.length === 0) {
        return { ...draft, history: { status: "unavailable" } };
      }
      const verdict = judgeSavedHint(draft.saved, merchants);
      const suggestedText = suggestHintText(merchants, null);
      const prefill = verdict.kind === "empty" && draft.text === draft.saved;
      return {
        ...draft,
        text: prefill ? suggestedText : draft.text,
        history: {
          status: "loaded",
          history: action.history,
          verdict,
          suggestedText,
        },
      };
    }
    case "history-unavailable":
      return action.categoryId !== draft.categoryId ||
        draft.history.status !== "loading"
        ? draft
        : { ...draft, history: { status: "unavailable" } };
    case "text-edited":
      return { ...draft, text: action.text, note: null };
    case "chip-clicked": {
      const result = applyMerchantChip(draft.text, action.merchant);
      return result.kind === "text"
        ? { ...draft, text: result.text, note: null }
        : { ...draft, note: result.message };
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
      return {
        ...draft,
        text: replace ? history.suggestedText : draft.text,
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
  if (history.status !== "loaded") {
    return {
      ...view,
      badge: null,
      mismatch: null,
      suggestions: { kind: "hidden" },
    };
  }

  const { verdict, suggestedText } = history;
  const { transactionCount, merchants } = history.history;
  const pending =
    verdict.kind === "names-none" && verdict.decision === "pending";
  const collapsed =
    !draft.panelOpen &&
    (verdict.kind === "names-history" ||
      (verdict.kind === "names-none" && verdict.decision === "kept"));
  const visible = draft.showAllMerchants
    ? merchants
    : merchants.slice(0, VISIBLE_CHIP_COUNT);

  return {
    ...view,
    badge:
      (verdict.kind === "empty" ||
        (verdict.kind === "names-none" && verdict.decision === "replaced")) &&
      draft.text === suggestedText &&
      draft.text !== draft.saved
        ? "suggested"
        : null,
    mismatch: pending ? { savedText: draft.saved, transactionCount } : null,
    suggestions: collapsed
      ? { kind: "collapsed", transactionCount }
      : {
          kind: "expanded",
          chips: visible.map((merchant) => ({
            merchant,
            presence: merchantPresence(draft.text, merchant),
          })),
          hiddenCount: merchants.length - visible.length,
          note: draft.note,
        },
  };
}
