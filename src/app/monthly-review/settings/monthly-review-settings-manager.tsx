"use client";

import type { OpenAIChatModelId } from "@ai-sdk/openai/internal";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  type ChatModelEntry,
  DEFAULT_CHAT_MODEL,
  getModelById,
} from "@/lib/monthly-review/chat-model-registry";

type SystemPromptResponse = {
  promptText: string;
  resolvedPrompt: string;
  usesDefaultPrompt: boolean;
  modelId: string | null;
  resolvedModelId: OpenAIChatModelId;
  usesDefaultModel: boolean;
  availableModels: ChatModelEntry[];
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
    "usesDefaultPrompt" in value &&
    typeof value.usesDefaultPrompt === "boolean" &&
    "modelId" in value &&
    (value.modelId === null || typeof value.modelId === "string") &&
    "resolvedModelId" in value &&
    typeof value.resolvedModelId === "string" &&
    "usesDefaultModel" in value &&
    typeof value.usesDefaultModel === "boolean" &&
    "availableModels" in value &&
    Array.isArray(value.availableModels) &&
    value.availableModels.every(
      (model) =>
        model &&
        typeof model === "object" &&
        "id" in model &&
        typeof model.id === "string" &&
        "label" in model &&
        typeof model.label === "string" &&
        "description" in model &&
        typeof model.description === "string" &&
        "tier" in model &&
        (model.tier === "cheap" ||
          model.tier === "balanced" ||
          model.tier === "premium"),
    )
  );
}

export function MonthlyReviewSettingsManager() {
  const [promptText, setPromptText] = useState("");
  const [resolvedPrompt, setResolvedPrompt] = useState("");
  const [usesDefaultPrompt, setUsesDefaultPrompt] = useState(false);
  const [selectedModelId, setSelectedModelId] =
    useState<OpenAIChatModelId>(DEFAULT_CHAT_MODEL);
  const [resolvedModelId, setResolvedModelId] =
    useState<OpenAIChatModelId>(DEFAULT_CHAT_MODEL);
  const [usesDefaultModel, setUsesDefaultModel] = useState(false);
  const [availableModels, setAvailableModels] = useState<ChatModelEntry[]>([]);
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
      setSelectedModelId(DEFAULT_CHAT_MODEL);
      setResolvedModelId(DEFAULT_CHAT_MODEL);
      setUsesDefaultModel(true);
      setAvailableModels([]);
      setError("Could not load monthly review system prompt.");
      setLoading(false);
      return;
    }

    setPromptText(body.promptText);
    setResolvedPrompt(body.resolvedPrompt);
    setUsesDefaultPrompt(body.usesDefaultPrompt);
    setSelectedModelId(getModelById(body.modelId ?? body.resolvedModelId).id);
    setResolvedModelId(body.resolvedModelId);
    setUsesDefaultModel(body.usesDefaultModel);
    setAvailableModels(body.availableModels);
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
    setSuccess(null);

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

    const body: unknown = await response.json().catch(() => null);

    if (!response.ok || !isSystemPromptResponse(body)) {
      setSaving(false);
      setError("Could not save monthly review settings. Please try again.");
      return false;
    }

    setPromptText(body.promptText);
    setResolvedPrompt(body.resolvedPrompt);
    setUsesDefaultPrompt(body.usesDefaultPrompt);
    setSelectedModelId(getModelById(body.modelId ?? body.resolvedModelId).id);
    setResolvedModelId(body.resolvedModelId);
    setUsesDefaultModel(body.usesDefaultModel);
    setAvailableModels(body.availableModels);
    setSaving(false);
    setSuccess(params.successMessage);
    return true;
  }

  async function handleSaveSystemPrompt() {
    await saveSettings({
      promptText,
      modelId: selectedModelId,
      successMessage: "System prompt saved.",
    });
  }

  async function handleModelChange(value: OpenAIChatModelId) {
    const previousModelId = selectedModelId;
    setSelectedModelId(value);
    setSuccess(null);

    const didSave = await saveSettings({
      promptText,
      modelId: value,
      successMessage: "Generation model saved.",
    });

    if (!didSave) {
      setSelectedModelId(previousModelId);
    }
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
        <h1 className="font-semibold text-2xl text-foreground tracking-tight">
          Monthly Review Settings
        </h1>
        <p className="text-muted-foreground text-sm">
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
            <p className="text-muted-foreground text-sm">Loading prompt...</p>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="monthly-review-openai-model">
                  Monthly review OpenAI model
                </Label>
                <Select
                  value={selectedModelId}
                  onValueChange={(value) => {
                    const nextModel = getModelById(value);
                    if (
                      !availableModels.some(
                        (model) => model.id === nextModel.id,
                      )
                    ) {
                      return;
                    }

                    void handleModelChange(nextModel.id);
                  }}
                  disabled={saving}
                >
                  <SelectTrigger id="monthly-review-openai-model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableModels.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        <span className="block text-sm">{model.label}</span>
                        <span className="block text-muted-foreground text-xs">
                          {model.description}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <p className="text-muted-foreground text-xs">
                {usesDefaultModel
                  ? `Using fallback model ${resolvedModelId}.`
                  : `Using saved model ${resolvedModelId}.`}
              </p>

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
                <p className="text-muted-foreground text-xs">
                  {usesDefaultPrompt
                    ? "Using fallback default prompt for generation."
                    : "Using saved custom prompt for generation."}
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

              {success ? (
                <p className="rounded-md border border-emerald-300/60 bg-emerald-50 px-3 py-2 text-emerald-700 text-sm dark:border-emerald-700/60 dark:bg-emerald-950/50 dark:text-emerald-200">
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
