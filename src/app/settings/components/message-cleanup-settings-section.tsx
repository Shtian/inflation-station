"use client";

import type { OpenAIChatModelId } from "@ai-sdk/openai/internal";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
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
  type PromptSettingsResponse,
  promptSettingsResponseSchema,
} from "@/lib/monthly-review/prompt-settings-response-schema";
import {
  getReasoningEffortById,
  type ReasoningEffort,
  type ReasoningEffortEntry,
  reasoningEffortEntrySchema,
  reasoningEffortSchema,
} from "@/lib/monthly-review/reasoning-effort-registry";
import { updateMessageCleanupSettingsFn } from "@/routes/settings/-server";
import {
  SettingsRow,
  SettingsSection,
  SettingsStatus,
} from "./settings-section";

const messageCleanupSettingsResponseSchema =
  promptSettingsResponseSchema.extend({
    reasoningEffort: z.string().nullable(),
    resolvedReasoningEffort: reasoningEffortSchema,
    usesDefaultReasoningEffort: z.boolean(),
    availableReasoningEfforts: z.array(reasoningEffortEntrySchema),
  });

export function MessageCleanupSettingsSection() {
  const updateMessageCleanupSettings = useServerFn(
    updateMessageCleanupSettingsFn,
  );
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
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [availableModelsSource, setAvailableModelsSource] =
    useState<PromptSettingsResponse["availableModelsSource"]>("openai");
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
      setError("Kunne ikke laste inn innstillingene for meldingsrydding.");
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

    let result: Awaited<ReturnType<typeof updateMessageCleanupSettings>>;
    try {
      result = await updateMessageCleanupSettings({
        data: {
          promptText: params.promptText,
          modelId: params.modelId,
          reasoningEffort: params.reasoningEffort,
        },
      });
    } catch {
      setSaving(false);
      setError(
        "Kunne ikke lagre innstillingene for meldingsrydding. Prøv igjen.",
      );
      return false;
    }

    if (!result.ok) {
      setSaving(false);
      setError(
        "Kunne ikke lagre innstillingene for meldingsrydding. Prøv igjen.",
      );
      return false;
    }

    const body = result.data;

    setPromptText(body.promptText);
    setResolvedPrompt(body.resolvedPrompt);
    setUsesDefaultPrompt(body.usesDefaultPrompt);
    setSelectedModelId(body.modelId ?? body.resolvedModelId);
    setResolvedModelId(body.resolvedModelId);
    setUsesDefaultModel(body.usesDefaultModel);
    setAvailableModels(body.availableModels);
    setAvailableModelsSource(body.availableModelsSource);
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
      successMessage: "Systemprompt lagret.",
    });
  }

  async function handleModelChange(value: OpenAIChatModelId) {
    const previousModelId = selectedModelId;
    setSelectedModelId(value);

    const didSave = await saveSettings({
      promptText,
      modelId: value,
      reasoningEffort: selectedReasoningEffort,
      successMessage: "Ryddemodell lagret.",
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
      successMessage: "Resonneringsnivå for rydding lagret.",
    });

    if (!didSave) {
      setSelectedReasoningEffort(previousReasoningEffort);
    }
  }

  return (
    <SettingsSection title="Import">
      {loading ? (
        <SettingsStatus>Laster inn innstillinger…</SettingsStatus>
      ) : (
        <>
          <SettingsRow
            label="OpenAI-modell for meldingsrydding"
            htmlFor="message-cleanup-openai-model"
            description="Modellen som rydder meldingstekster ved import."
          >
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
              <SelectTrigger
                id="message-cleanup-openai-model"
                className="w-full"
              >
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
              <p className="text-muted-foreground text-xs">
                Kunne ikke laste inn modeller fra OpenAI. Viser bare den lagrede
                modellen.
              </p>
            ) : null}
            <p className="text-muted-foreground text-xs">
              {usesDefaultModel
                ? `Bruker standardmodellen ${resolvedModelId}.`
                : `Bruker den lagrede modellen ${resolvedModelId}.`}
            </p>
          </SettingsRow>

          <SettingsRow
            label="Resonneringsnivå for meldingsrydding"
            htmlFor="message-cleanup-reasoning-effort"
            description="Hvor grundig modellen tenker før den foreslår en ryddet melding."
          >
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
              <SelectTrigger
                id="message-cleanup-reasoning-effort"
                className="w-full"
              >
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
            <p className="text-muted-foreground text-xs">
              {usesDefaultReasoningEffort
                ? `Bruker standardnivået ${getReasoningEffortById(resolvedReasoningEffortState).label}.`
                : `Bruker det lagrede nivået ${getReasoningEffortById(resolvedReasoningEffortState).label}.`}
            </p>
          </SettingsRow>

          <SettingsRow
            label="Systemprompt for meldingsrydding"
            htmlFor="message-cleanup-system-prompt"
            description="Grunninstruksjonene for rydding. La feltet stå tomt for å bruke standardprompten."
            layout="stacked"
          >
            <Textarea
              id="message-cleanup-system-prompt"
              value={promptText}
              onChange={(event) => {
                setPromptText(event.target.value);
              }}
              rows={8}
              placeholder="La stå tomt for å bruke standardprompten."
            />

            <p className="text-muted-foreground text-xs">
              {usesDefaultPrompt
                ? "Bruker standardprompten for rydding."
                : "Bruker den lagrede egendefinerte prompten for rydding."}
            </p>
            {usesDefaultPrompt ? (
              <p className="rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-muted-foreground text-xs">
                {resolvedPrompt}
              </p>
            ) : null}

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
          </SettingsRow>
        </>
      )}
    </SettingsSection>
  );
}
