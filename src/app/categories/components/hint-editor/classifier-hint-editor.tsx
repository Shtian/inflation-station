"use client";

import { Check, History, Plus, TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { HINT_SOFT_LIMIT } from "@/lib/categorization/hint-text";
import { cn } from "@/lib/utils";
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
          <div className="space-y-2 border-border border-t pt-3">
            <p className="font-medium text-xs">
              From your history{" "}
              <span className="font-normal text-muted-foreground">
                · times used
              </span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.chips.map(({ merchant, presence }) => (
                <button
                  key={merchant.key}
                  type="button"
                  aria-pressed={presence === "on"}
                  title={
                    presence === "mentioned"
                      ? "Mentioned in your own wording"
                      : undefined
                  }
                  onClick={() => dispatch({ type: "chip-clicked", merchant })}
                  disabled={disabled}
                  className={cn(
                    "inline-flex h-6 items-center gap-1 rounded-full border px-2.5 text-xs transition-colors disabled:opacity-50",
                    presence === "on"
                      ? "border-foreground/20 bg-muted"
                      : "border-border bg-background hover:bg-muted",
                  )}
                >
                  {presence === "off" ? (
                    <Plus className="size-3" aria-hidden="true" />
                  ) : (
                    <Check className="size-3" aria-hidden="true" />
                  )}
                  {merchant.label}
                  <span className="text-muted-foreground">
                    {merchant.transactionCount}
                  </span>
                </button>
              ))}
              {suggestions.hiddenCount > 0 ? (
                <Button
                  type="button"
                  variant="link"
                  size="xs"
                  onClick={() => dispatch({ type: "show-all-merchants" })}
                  disabled={disabled}
                >
                  +{suggestions.hiddenCount} more
                </Button>
              ) : null}
            </div>
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
