"use client";

import type { OpenAIChatModelId } from "@ai-sdk/openai/internal";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  type PromptSettingsResponse,
  promptSettingsResponseSchema,
} from "@/lib/monthly-review/prompt-settings-response-schema";
import { DEFAULT_MONTHLY_REVIEW_OPENAI_MODEL } from "@/lib/monthly-review/system-prompt";

export function MonthlyReviewSettingsManager() {
  const [promptText, setPromptText] = useState("");
  const [resolvedPrompt, setResolvedPrompt] = useState("");
  const [usesDefaultPrompt, setUsesDefaultPrompt] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState<OpenAIChatModelId>(
    DEFAULT_MONTHLY_REVIEW_OPENAI_MODEL,
  );
  const [resolvedModelId, setResolvedModelId] = useState<OpenAIChatModelId>(
    DEFAULT_MONTHLY_REVIEW_OPENAI_MODEL,
  );
  const [usesDefaultModel, setUsesDefaultModel] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [availableModelsSource, setAvailableModelsSource] =
    useState<PromptSettingsResponse["availableModelsSource"]>("openai");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSystemPrompt = useCallback(async () => {
    setLoading(true);
    setError(null);

    const response = await fetch("/api/monthly-review/system-prompt");
    const rawBody: unknown = await response.json().catch(() => null);
    const parsed = promptSettingsResponseSchema.safeParse(rawBody);

    if (!response.ok || !parsed.success) {
      setPromptText("");
      setResolvedPrompt("");
      setUsesDefaultPrompt(true);
      setSelectedModelId(DEFAULT_MONTHLY_REVIEW_OPENAI_MODEL);
      setResolvedModelId(DEFAULT_MONTHLY_REVIEW_OPENAI_MODEL);
      setUsesDefaultModel(true);
      setAvailableModels([]);
      setError("Kunne ikke laste inn systemprompten for månedsoppsummering.");
      setLoading(false);
      return;
    }

    const body = parsed.data;
    setPromptText(body.promptText);
    setResolvedPrompt(body.resolvedPrompt);
    setUsesDefaultPrompt(body.usesDefaultPrompt);
    setSelectedModelId(body.modelId ?? body.resolvedModelId);
    setResolvedModelId(body.resolvedModelId);
    setUsesDefaultModel(body.usesDefaultModel);
    setAvailableModels(body.availableModels);
    setAvailableModelsSource(body.availableModelsSource);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadSystemPrompt();
  }, [loadSystemPrompt]);

  async function saveSettings(params: {
    promptText: string;
    modelId: OpenAIChatModelId;
    successMessage: string;
  }): Promise<boolean> {
    if (saving) {
      return false;
    }

    setSaving(true);
    setError(null);

    const response = await fetch("/api/monthly-review/system-prompt", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        promptText: params.promptText,
        modelId: params.modelId,
      }),
    });

    const rawBody: unknown = await response.json().catch(() => null);
    const parsed = promptSettingsResponseSchema.safeParse(rawBody);

    if (!response.ok || !parsed.success) {
      setSaving(false);
      setError(
        "Kunne ikke lagre innstillingene for månedsoppsummering. Prøv igjen.",
      );
      return false;
    }

    const body = parsed.data;
    setPromptText(body.promptText);
    setResolvedPrompt(body.resolvedPrompt);
    setUsesDefaultPrompt(body.usesDefaultPrompt);
    setSelectedModelId(body.modelId ?? body.resolvedModelId);
    setResolvedModelId(body.resolvedModelId);
    setUsesDefaultModel(body.usesDefaultModel);
    setAvailableModels(body.availableModels);
    setAvailableModelsSource(body.availableModelsSource);
    setSaving(false);
    toast.success(params.successMessage);
    return true;
  }

  async function handleSaveSystemPrompt() {
    await saveSettings({
      promptText,
      modelId: selectedModelId,
      successMessage: "Systemprompt lagret.",
    });
  }

  async function handleModelChange(value: OpenAIChatModelId) {
    const previousModelId = selectedModelId;
    setSelectedModelId(value);

    const didSave = await saveSettings({
      promptText,
      modelId: value,
      successMessage: "Genereringsmodell lagret.",
    });

    if (!didSave) {
      setSelectedModelId(previousModelId);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Link
          href="/monthly-review"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          <ArrowLeft aria-hidden />
          Tilbake til månedsoppsummering
        </Link>
        <h1 className="font-semibold text-2xl text-foreground tracking-tight">
          Innstillinger for månedsoppsummering
        </h1>
        <p className="text-muted-foreground text-sm">
          Konfigurer grunnleggende AI-instruksjoner for fremtidige
          månedsoppsummeringer.
        </p>
      </div>

      <Card>
        <CardHeader className="space-y-1">
          <CardTitle>
            <h2 className="text-lg">Systemprompt</h2>
          </CardTitle>
          <CardDescription>
            La feltet stå tomt for å bruke standardprompten.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-muted-foreground text-sm">Laster inn prompt…</p>
          ) : (
            <>
              <Field>
                <FieldLabel htmlFor="monthly-review-openai-model">
                  OpenAI-modell for månedsoppsummering
                </FieldLabel>
                <FieldContent>
                  <Select
                    items={availableModels.map((modelId) => ({
                      value: modelId,
                      label: modelId,
                    }))}
                    value={selectedModelId}
                    onValueChange={(value) => {
                      if (value === null || !availableModels.includes(value)) {
                        return;
                      }

                      void handleModelChange(value);
                    }}
                    disabled={saving}
                  >
                    <SelectTrigger id="monthly-review-openai-model">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableModels.map((modelId) => (
                        <SelectItem key={modelId} value={modelId}>
                          {modelId}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {availableModelsSource === "unavailable" ? (
                    <FieldDescription className="text-xs">
                      Kunne ikke laste inn modeller fra OpenAI. Viser bare den
                      lagrede modellen.
                    </FieldDescription>
                  ) : null}
                </FieldContent>
              </Field>

              <p className="text-muted-foreground text-xs">
                {usesDefaultModel
                  ? `Bruker standardmodellen ${resolvedModelId}.`
                  : `Bruker den lagrede modellen ${resolvedModelId}.`}
              </p>

              <Field>
                <FieldLabel htmlFor="monthly-review-system-prompt">
                  Systemprompt for månedsoppsummering
                </FieldLabel>
                <FieldContent>
                  <Textarea
                    id="monthly-review-system-prompt"
                    value={promptText}
                    onChange={(event) => {
                      setPromptText(event.target.value);
                    }}
                    rows={10}
                    placeholder="La stå tomt for å bruke standardprompten."
                  />
                </FieldContent>
              </Field>

              <div className="space-y-1">
                <p className="text-muted-foreground text-xs">
                  {usesDefaultPrompt
                    ? "Bruker standardprompten for generering."
                    : "Bruker den lagrede egendefinerte prompten for generering."}
                </p>
                {usesDefaultPrompt ? (
                  <p className="rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-muted-foreground text-xs">
                    {resolvedPrompt}
                  </p>
                ) : null}
              </div>

              {error ? (
                <p
                  role="alert"
                  className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-destructive text-sm"
                >
                  {error}
                </p>
              ) : null}

              <div>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveSystemPrompt}
                  disabled={saving}
                >
                  {saving ? "Lagrer…" : "Lagre prompt"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
