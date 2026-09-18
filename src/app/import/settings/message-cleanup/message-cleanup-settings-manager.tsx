"use client";

import type { OpenAIChatModelId } from "@ai-sdk/openai/internal";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { updateMessageCleanupSettingsAction } from "@/app/actions/update-message-cleanup-settings";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldContent, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_MESSAGE_CLEANUP_OPENAI_MODEL,
  DEFAULT_MESSAGE_CLEANUP_REASONING_EFFORT,
} from "@/lib/import/message-cleanup-settings";
import {
  type ChatModelEntry,
  getModelById,
} from "@/lib/monthly-review/chat-model-registry";
import { promptSettingsResponseSchema } from "@/lib/monthly-review/prompt-settings-response-schema";
import {
  getReasoningEffortById,
  type ReasoningEffort,
  type ReasoningEffortEntry,
  reasoningEffortEntrySchema,
  reasoningEffortSchema,
} from "@/lib/monthly-review/reasoning-effort-registry";

const messageCleanupSettingsResponseSchema =
  promptSettingsResponseSchema.extend({
    reasoningEffort: z.string().nullable(),
    resolvedReasoningEffort: reasoningEffortSchema,
    usesDefaultReasoningEffort: z.boolean(),
    availableReasoningEfforts: z.array(reasoningEffortEntrySchema),
  });

export function MessageCleanupSettingsManager() {
  const [promptText, setPromptText] = useState("");
  const [resolvedPrompt, setResolvedPrompt] = useState("");
  const [usesDefaultPrompt, setUsesDefaultPrompt] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState<OpenAIChatModelId>(
    DEFAULT_MESSAGE_CLEANUP_OPENAI_MODEL,
  );
  const [resolvedModelId, setResolvedModelId] = useState<OpenAIChatModelId>(
    DEFAULT_MESSAGE_CLEANUP_OPENAI_MODEL,
  );
  const [usesDefaultModel, setUsesDefaultModel] = useState(false);
  const [availableModels, setAvailableModels] = useState<ChatModelEntry[]>([]);
  const [selectedReasoningEffort, setSelectedReasoningEffort] =
    useState<ReasoningEffort>(DEFAULT_MESSAGE_CLEANUP_REASONING_EFFORT);
  const [resolvedReasoningEffortState, setResolvedReasoningEffortState] =
    useState<ReasoningEffort>(DEFAULT_MESSAGE_CLEANUP_REASONING_EFFORT);
  const [usesDefaultReasoningEffort, setUsesDefaultReasoningEffort] =
    useState(false);
  const [availableReasoningEfforts, setAvailableReasoningEfforts] = useState<
    ReasoningEffortEntry[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);

    const response = await fetch("/api/imports/message-cleanup-settings");
    const rawBody: unknown = await response.json().catch(() => null);
    const parsed = messageCleanupSettingsResponseSchema.safeParse(rawBody);

    if (!response.ok || !parsed.success) {
      setPromptText("");
      setResolvedPrompt("");
      setUsesDefaultPrompt(true);
      setSelectedModelId(DEFAULT_MESSAGE_CLEANUP_OPENAI_MODEL);
      setResolvedModelId(DEFAULT_MESSAGE_CLEANUP_OPENAI_MODEL);
      setUsesDefaultModel(true);
      setAvailableModels([]);
      setSelectedReasoningEffort(DEFAULT_MESSAGE_CLEANUP_REASONING_EFFORT);
      setResolvedReasoningEffortState(DEFAULT_MESSAGE_CLEANUP_REASONING_EFFORT);
      setUsesDefaultReasoningEffort(true);
      setAvailableReasoningEfforts([]);
      setError("Could not load message cleanup settings.");
      setLoading(false);
      return;
    }

    const body = parsed.data;
    setPromptText(body.promptText);
    setResolvedPrompt(body.resolvedPrompt);
    setUsesDefaultPrompt(body.usesDefaultPrompt);
    setSelectedModelId(getModelById(body.modelId ?? body.resolvedModelId).id);
    setResolvedModelId(body.resolvedModelId);
    setUsesDefaultModel(body.usesDefaultModel);
    setAvailableModels(body.availableModels);
    setSelectedReasoningEffort(
      getReasoningEffortById(
        body.reasoningEffort ?? body.resolvedReasoningEffort,
      ).id,
    );
    setResolvedReasoningEffortState(body.resolvedReasoningEffort);
    setUsesDefaultReasoningEffort(body.usesDefaultReasoningEffort);
    setAvailableReasoningEfforts(body.availableReasoningEfforts);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  async function saveSettings(params: {
    promptText: string;
    modelId: OpenAIChatModelId;
    reasoningEffort: ReasoningEffort;
    successMessage: string;
  }): Promise<boolean> {
    if (saving) {
      return false;
    }

    setSaving(true);
    setError(null);

    let result: Awaited<ReturnType<typeof updateMessageCleanupSettingsAction>>;
    try {
      result = await updateMessageCleanupSettingsAction({
        promptText: params.promptText,
        modelId: params.modelId,
        reasoningEffort: params.reasoningEffort,
      });
    } catch {
      setSaving(false);
      setError("Could not save message cleanup settings. Please try again.");
      return false;
    }

    if (!result.ok) {
      setSaving(false);
      setError("Could not save message cleanup settings. Please try again.");
      return false;
    }

    const body = result.data;

    setPromptText(body.promptText);
    setResolvedPrompt(body.resolvedPrompt);
    setUsesDefaultPrompt(body.usesDefaultPrompt);
    setSelectedModelId(getModelById(body.modelId ?? body.resolvedModelId).id);
    setResolvedModelId(body.resolvedModelId);
    setUsesDefaultModel(body.usesDefaultModel);
    setAvailableModels(body.availableModels);
    setSelectedReasoningEffort(
      getReasoningEffortById(
        body.reasoningEffort ?? body.resolvedReasoningEffort,
      ).id,
    );
    setResolvedReasoningEffortState(body.resolvedReasoningEffort);
    setUsesDefaultReasoningEffort(body.usesDefaultReasoningEffort);
    setAvailableReasoningEfforts(body.availableReasoningEfforts);
    setSaving(false);
    toast.success(params.successMessage);
    return true;
  }

  async function handleSaveSystemPrompt() {
    await saveSettings({
      promptText,
      modelId: selectedModelId,
      reasoningEffort: selectedReasoningEffort,
      successMessage: "System prompt saved.",
    });
  }

  async function handleModelChange(value: OpenAIChatModelId) {
    const previousModelId = selectedModelId;
    setSelectedModelId(value);

    const didSave = await saveSettings({
      promptText,
      modelId: value,
      reasoningEffort: selectedReasoningEffort,
      successMessage: "Cleanup model saved.",
    });

    if (!didSave) {
      setSelectedModelId(previousModelId);
    }
  }

  async function handleReasoningEffortChange(value: ReasoningEffort) {
    const previousReasoningEffort = selectedReasoningEffort;
    setSelectedReasoningEffort(value);

    const didSave = await saveSettings({
      promptText,
      modelId: selectedModelId,
      reasoningEffort: value,
      successMessage: "Cleanup reasoning effort saved.",
    });

    if (!didSave) {
      setSelectedReasoningEffort(previousReasoningEffort);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Link
          href="/import"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          <ArrowLeft aria-hidden />
          Back to import
        </Link>
        <h1 className="font-semibold text-2xl text-foreground tracking-tight">
          Message Cleanup Settings
        </h1>
        <p className="text-muted-foreground text-sm">
          Configure model and baseline instructions for import message cleanup.
        </p>
      </div>

      <Card>
        <CardHeader className="space-y-1">
          <CardTitle>
            <h2 className="text-lg">System prompt</h2>
          </CardTitle>
          <CardDescription>
            Leave this blank to use the default cleanup prompt.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-muted-foreground text-sm">Loading settings...</p>
          ) : (
            <>
              <Field>
                <FieldLabel htmlFor="message-cleanup-openai-model">
                  Message cleanup OpenAI model
                </FieldLabel>
                <FieldContent>
                  <Select
                    items={availableModels.map((model) => ({
                      value: model.id,
                      label: model.label,
                    }))}
                    value={selectedModelId}
                    onValueChange={(value) => {
                      if (value === null) return;
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
                    <SelectTrigger id="message-cleanup-openai-model">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableModels.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldContent>
              </Field>

              <p className="text-muted-foreground text-xs">
                {usesDefaultModel
                  ? `Using fallback model ${resolvedModelId}.`
                  : `Using saved model ${resolvedModelId}.`}
              </p>

              <Field>
                <FieldLabel htmlFor="message-cleanup-reasoning-effort">
                  Message cleanup reasoning effort
                </FieldLabel>
                <FieldContent>
                  <Select
                    items={availableReasoningEfforts.map((effort) => ({
                      value: effort.id,
                      label: effort.label,
                    }))}
                    value={selectedReasoningEffort}
                    onValueChange={(value) => {
                      if (value === null) return;
                      const nextReasoningEffort = getReasoningEffortById(value);
                      if (
                        !availableReasoningEfforts.some(
                          (effort) => effort.id === nextReasoningEffort.id,
                        )
                      ) {
                        return;
                      }

                      void handleReasoningEffortChange(nextReasoningEffort.id);
                    }}
                    disabled={saving}
                  >
                    <SelectTrigger id="message-cleanup-reasoning-effort">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableReasoningEfforts.map((effort) => (
                        <SelectItem key={effort.id} value={effort.id}>
                          {effort.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldContent>
              </Field>

              <p className="text-muted-foreground text-xs">
                {usesDefaultReasoningEffort
                  ? `Using fallback effort ${resolvedReasoningEffortState}.`
                  : `Using saved effort ${resolvedReasoningEffortState}.`}
              </p>

              <Field>
                <FieldLabel htmlFor="message-cleanup-system-prompt">
                  Message cleanup system prompt
                </FieldLabel>
                <FieldContent>
                  <Textarea
                    id="message-cleanup-system-prompt"
                    value={promptText}
                    onChange={(event) => {
                      setPromptText(event.target.value);
                    }}
                    rows={8}
                    placeholder="Leave empty to use default prompt."
                  />
                </FieldContent>
              </Field>

              <div className="space-y-1">
                <p className="text-muted-foreground text-xs">
                  {usesDefaultPrompt
                    ? "Using fallback default prompt for cleanup."
                    : "Using saved custom prompt for cleanup."}
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
