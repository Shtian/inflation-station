"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type SystemPromptResponse = {
  promptText: string;
  resolvedPrompt: string;
  usesDefaultPrompt: boolean;
};

function isSystemPromptResponse(value: unknown): value is SystemPromptResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  if (!("promptText" in value) || typeof value.promptText !== "string") {
    return false;
  }

  if (
    !("resolvedPrompt" in value) ||
    typeof value.resolvedPrompt !== "string"
  ) {
    return false;
  }

  return (
    "usesDefaultPrompt" in value && typeof value.usesDefaultPrompt === "boolean"
  );
}

export function MonthlyReviewSettingsManager() {
  const [promptText, setPromptText] = useState("");
  const [resolvedPrompt, setResolvedPrompt] = useState("");
  const [usesDefaultPrompt, setUsesDefaultPrompt] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadSystemPrompt = useCallback(async () => {
    setLoading(true);
    setError(null);

    const response = await fetch("/api/monthly-review/system-prompt");
    const body: unknown = await response.json().catch(() => null);

    if (!response.ok || !isSystemPromptResponse(body)) {
      setPromptText("");
      setResolvedPrompt("");
      setUsesDefaultPrompt(true);
      setError("Could not load monthly review system prompt.");
      setLoading(false);
      return;
    }

    setPromptText(body.promptText);
    setResolvedPrompt(body.resolvedPrompt);
    setUsesDefaultPrompt(body.usesDefaultPrompt);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadSystemPrompt();
  }, [loadSystemPrompt]);

  async function handleSaveSystemPrompt() {
    if (saving) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    const response = await fetch("/api/monthly-review/system-prompt", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ promptText }),
    });

    const body: unknown = await response.json().catch(() => null);

    if (!response.ok || !isSystemPromptResponse(body)) {
      setSaving(false);
      setError(
        "Could not save monthly review system prompt. Please try again.",
      );
      return;
    }

    setPromptText(body.promptText);
    setResolvedPrompt(body.resolvedPrompt);
    setUsesDefaultPrompt(body.usesDefaultPrompt);
    setSaving(false);
    setSuccess("System prompt saved.");
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Button type="button" variant="ghost" size="sm" asChild>
          <Link href="/monthly-review">
            <ArrowLeft aria-hidden />
            Back to monthly review
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Monthly Review Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Configure baseline AI instructions used for future monthly review
          generation.
        </p>
      </div>

      <Card>
        <CardHeader className="space-y-1">
          <CardTitle>
            <h2 className="text-lg">System prompt</h2>
          </CardTitle>
          <CardDescription>
            Leave this blank to use the default prompt.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading prompt...</p>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="monthly-review-system-prompt">
                  Monthly review system prompt
                </Label>
                <Textarea
                  id="monthly-review-system-prompt"
                  value={promptText}
                  onChange={(event) => {
                    setPromptText(event.target.value);
                    setSuccess(null);
                  }}
                  rows={10}
                  placeholder="Leave empty to use default prompt."
                />
              </div>

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  {usesDefaultPrompt
                    ? "Using fallback default prompt for generation."
                    : "Using saved custom prompt for generation."}
                </p>
                {usesDefaultPrompt ? (
                  <p className="rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    {resolvedPrompt}
                  </p>
                ) : null}
              </div>

              {error ? (
                <p
                  role="alert"
                  className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {error}
                </p>
              ) : null}

              {success ? (
                <p className="rounded-md border border-emerald-300/60 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-700/60 dark:bg-emerald-950/50 dark:text-emerald-200">
                  {success}
                </p>
              ) : null}

              <div>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveSystemPrompt}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save prompt"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
