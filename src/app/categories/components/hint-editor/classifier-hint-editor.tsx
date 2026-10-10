"use client";

import {
  Check,
  History,
  Loader2,
  Plus,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import {
  HINT_SOFT_LIMIT,
  type HintMerchant,
  type MerchantPresence,
} from "@/lib/categorization/hint-text";
import { cn } from "@/lib/utils";
import {
  fetchHintGuess,
  type HintGuessUnavailableReason,
} from "./fetch-hint-guess";
import { fetchMerchantHistory } from "./fetch-merchant-history";
import {
  type HintDraft,
  type HintDraftAction,
  viewHintDraft,
} from "./hint-draft";

type ClassifierHintEditorProps = {
  id: string;
  label: string;
  description: string;
  placeholder: string;
  categoryName: string;
  value: { draft: HintDraft; dispatch: (action: HintDraftAction) => void };
  disabled: boolean;
};

export function ClassifierHintEditor({
  id,
  label,
  description,
  placeholder,
  categoryName,
  value: { draft, dispatch },
  disabled,
}: ClassifierHintEditorProps) {
  const { categoryId } = draft;
  const loading = draft.history.status === "loading";

  useEffect(() => {
    if (!loading) {
      return;
    }
    const controller = new AbortController();
    void fetchMerchantHistory(categoryId, controller.signal).then((history) => {
      if (controller.signal.aborted) {
        return;
      }
      dispatch(
        history
          ? { type: "history-loaded", categoryId, history }
          : { type: "history-unavailable", categoryId },
      );
    });
    return () => controller.abort();
  }, [categoryId, loading, dispatch]);

  const guessLoading = draft.guess.status === "loading";

  useEffect(() => {
    if (!guessLoading) {
      return;
    }
    const controller = new AbortController();
    void fetchHintGuess(categoryId, controller.signal).then((result) => {
      if (controller.signal.aborted) {
        return;
      }
      dispatch(
        result.kind === "loaded"
          ? { type: "guess-loaded", categoryId, guess: result.guess }
          : { type: "guess-unavailable", categoryId, reason: result.reason },
      );
    });
    return () => controller.abort();
  }, [categoryId, guessLoading, dispatch]);

  const view = viewHintDraft(draft, categoryName);
  const { suggestions } = view;

  return (
    <Field>
      <div className="flex items-center justify-between gap-2">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {view.badge === "suggested" ? (
          <Badge variant="secondary">Suggested · not saved</Badge>
        ) : null}
      </div>
      <FieldContent className="gap-2">
        {view.mismatch ? (
          <div className="flex gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm">
            <TriangleAlert
              className="mt-0.5 size-4 shrink-0 text-warning"
              aria-hidden="true"
            />
            <div className="space-y-2">
              <p>
                Your saved hint names{" "}
                <span className="font-medium">{view.mismatch.savedText}</span>.
                None of them appear in the {view.mismatch.transactionCount}{" "}
                transactions filed here.
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => dispatch({ type: "replace-with-suggestion" })}
                  disabled={disabled}
                >
                  Replace with suggestion
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => dispatch({ type: "keep-saved" })}
                  disabled={disabled}
                >
                  Keep mine
                </Button>
              </div>
            </div>
          </div>
        ) : null}
        <Textarea
          id={id}
          value={draft.text}
          onChange={(event) =>
            dispatch({ type: "text-edited", text: event.target.value })
          }
          placeholder={placeholder}
          rows={2}
          disabled={disabled}
        />
        <div className="flex items-start justify-between gap-3 text-muted-foreground text-xs">
          <p>
            Jev reads <span className="text-foreground">{view.jevLine}</span>
          </p>
          <span
            className={cn(
              "shrink-0 tabular-nums",
              view.overBudget && "text-warning",
            )}
          >
            {view.length} / {HINT_SOFT_LIMIT}
          </span>
        </div>
        <FieldDescription>{description}</FieldDescription>
        {suggestions.kind === "collapsed" ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-fit gap-1.5 text-muted-foreground"
            onClick={() => dispatch({ type: "open-panel" })}
            disabled={disabled}
          >
            <History aria-hidden="true" />
            Suggestions from {suggestions.transactionCount} transactions
          </Button>
        ) : null}
        {suggestions.kind === "expanded" ? (
          <div className="space-y-3 border-border border-t pt-3">
            {suggestions.description ? (
              <label
                htmlFor={`${id}-description`}
                className="flex cursor-pointer items-start gap-2 text-sm"
              >
                <Checkbox
                  id={`${id}-description`}
                  aria-labelledby={`${id}-description-label`}
                  className="mt-0.5"
                  checked={suggestions.description.checked}
                  onCheckedChange={(checked) =>
                    dispatch({ type: "description-set", on: checked })
                  }
                  disabled={disabled}
                />
                <span id={`${id}-description-label`}>
                  <span className="text-muted-foreground">Start with</span> “
                  {suggestions.description.text}”
                </span>
              </label>
            ) : null}
            {suggestions.history ? (
              <div className="space-y-2">
                <p className="font-medium text-xs">
                  From your history{" "}
                  <span className="font-normal text-muted-foreground">
                    · times used
                  </span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.history.chips.map(({ merchant, presence }) => (
                    <MerchantChip
                      key={merchant.key}
                      merchant={merchant}
                      presence={presence}
                      count={merchant.transactionCount}
                      onClick={() =>
                        dispatch({ type: "chip-clicked", merchant })
                      }
                      disabled={disabled}
                    />
                  ))}
                  {suggestions.history.hiddenCount > 0 ? (
                    <Button
                      type="button"
                      variant="link"
                      size="xs"
                      onClick={() => dispatch({ type: "show-all-merchants" })}
                      disabled={disabled}
                    >
                      +{suggestions.history.hiddenCount} more
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
            {suggestions.guesses.length > 0 ? (
              <div className="space-y-2">
                <p className="font-medium text-xs">
                  Not in your history{" "}
                  <span className="font-normal text-muted-foreground">
                    · likely to show up later
                  </span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.guesses.map(({ merchant, presence }) => (
                    <MerchantChip
                      key={merchant.key}
                      merchant={merchant}
                      presence={presence}
                      guess
                      onClick={() =>
                        dispatch({ type: "chip-clicked", merchant })
                      }
                      disabled={disabled}
                    />
                  ))}
                </div>
              </div>
            ) : null}
            {suggestions.ai?.kind === "suggest" ? (
              <div className="flex flex-wrap items-center gap-1.5 text-muted-foreground text-xs">
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() =>
                    dispatch({ type: "guess-requested", categoryId })
                  }
                  disabled={disabled}
                >
                  <Sparkles aria-hidden="true" />
                  Suggest with AI
                </Button>
                <span>· description and similar merchants</span>
              </div>
            ) : null}
            {suggestions.ai?.kind === "pending" ? (
              <p className="flex items-center gap-1.5 text-muted-foreground text-xs">
                <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                Finding similar merchants…
              </p>
            ) : null}
            {suggestions.ai?.kind === "unavailable" ? (
              <p className="flex flex-wrap items-center gap-1 text-muted-foreground text-xs">
                {AI_UNAVAILABLE_MESSAGES[suggestions.ai.reason]}
                {suggestions.ai.reason === "failed" ? (
                  <Button
                    type="button"
                    variant="link"
                    size="xs"
                    className="h-auto px-0"
                    onClick={() =>
                      dispatch({ type: "guess-requested", categoryId })
                    }
                    disabled={disabled}
                  >
                    Try again
                  </Button>
                ) : null}
              </p>
            ) : null}
            {suggestions.note ? (
              <output className="block text-muted-foreground text-xs">
                {suggestions.note}
              </output>
            ) : null}
          </div>
        ) : null}
      </FieldContent>
    </Field>
  );
}

const AI_UNAVAILABLE_MESSAGES: Record<HintGuessUnavailableReason, string> = {
  disabled: "AI suggestions are turned off.",
  key_missing: "AI suggestions unavailable: OPENAI_API_KEY is missing.",
  failed: "Couldn't get AI suggestions.",
};

function MerchantChip({
  merchant,
  presence,
  count,
  guess = false,
  onClick,
  disabled,
}: {
  merchant: HintMerchant;
  presence: MerchantPresence;
  count?: number;
  guess?: boolean;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={presence === "on"}
      title={
        presence === "mentioned" ? "Mentioned in your own wording" : undefined
      }
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full border px-2.5 text-xs transition-colors disabled:opacity-50",
        presence === "on"
          ? "border-foreground/20 bg-muted"
          : guess
            ? "border-muted-foreground/50 border-dashed bg-transparent text-muted-foreground hover:bg-muted"
            : "border-border bg-background hover:bg-muted",
      )}
    >
      {presence === "off" ? (
        <Plus className="size-3" aria-hidden="true" />
      ) : (
        <Check className="size-3" aria-hidden="true" />
      )}
      {merchant.label}
      {count === undefined ? null : (
        <span className="text-muted-foreground">{count}</span>
      )}
    </button>
  );
}
