"use client";

import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from "ai";
import { RotateCcw, SquarePen } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Confirmation,
  ConfirmationAccepted,
  ConfirmationAction,
  ConfirmationActions,
  ConfirmationRejected,
  ConfirmationRequest,
} from "@/components/ai-elements/confirmation";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Suggestion } from "@/components/ai-elements/suggestion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ONBOARDING_CHAT_ENDPOINT,
  type OnboardingUIMessage,
} from "@/lib/onboarding/contract";
import type { CategoryKindName } from "@/lib/onboarding/progress";
import type { BatchResult } from "@/lib/onboarding/setup-store";

const PROPOSAL_DECLINED_REASON =
  "The user clicked Not yet. Nothing failed; they want to change the proposal.";

const SUGGESTIONS = [
  "Jeg har DNB: en brukskonto, en sparekonto og et kredittkort",
  "Foreslå kategorier for en vanlig husholdning",
  "Hvordan holder jeg overføringer mellom kontoene mine utenfor statistikken?",
];

const KIND_LABELS: Record<CategoryKindName, string> = {
  EXPENSE: "Utgift",
  INCOME: "Inntekt",
  TRANSFER: "Overføring",
};

type ProposalPart = Extract<
  OnboardingUIMessage["parts"][number],
  { type: "tool-addAccounts" } | { type: "tool-addCategories" }
>;

type ProposalRow = { name: string; kind?: CategoryKindName; detail?: string };

const transport = new DefaultChatTransport<OnboardingUIMessage>({
  api: ONBOARDING_CHAT_ENDPOINT,
});

function describeChatError(error: Error): string {
  if (error.message.includes("ONBOARDING_UNAVAILABLE")) {
    return "Oppsettsguiden er ikke tilgjengelig på denne serveren akkurat nå.";
  }
  if (error.message.includes("INVALID_ONBOARDING_MESSAGES")) {
    return "Samtalen kunne ikke leses. Start en ny samtale.";
  }
  return "Fikk ikke kontakt med oppsettsguiden.";
}

function describeBatchResult({ created, existing }: BatchResult) {
  const sentences = [];
  if (created.length > 0) {
    sentences.push(`La til ${created.join(", ")}.`);
  }
  if (existing.length > 0) {
    sentences.push(`Fantes allerede: ${existing.join(", ")}.`);
  }
  return sentences.join(" ") || "Ingenting å legge til.";
}

function isProposalPart(
  part: OnboardingUIMessage["parts"][number],
): part is ProposalPart {
  return part.type === "tool-addAccounts" || part.type === "tool-addCategories";
}

function proposalRows(part: ProposalPart): ProposalRow[] {
  if (part.state === "input-streaming" || !part.input) {
    return [];
  }
  if (part.type === "tool-addAccounts") {
    return part.input.accounts.map((account) => ({
      name: account.name,
      detail: account.institution,
    }));
  }
  return part.input.categories.map((category) => ({
    name: category.name,
    kind: category.kind,
    detail: category.classifierHint,
  }));
}

function ProposalCard({
  part,
  isLatest,
  onRespond,
}: {
  part: ProposalPart;
  isLatest: boolean;
  onRespond: (approvalId: string, approved: boolean) => void;
}) {
  const noun = part.type === "tool-addAccounts" ? "kontoer" : "kategorier";
  switch (part.state) {
    case "input-streaming":
    case "input-available":
      return (
        <p className="text-muted-foreground text-xs">Forbereder {noun}…</p>
      );
    case "approval-requested":
    case "approval-responded":
    case "output-denied":
      if (part.state === "approval-requested" && !isLatest) {
        return (
          <p className="text-muted-foreground text-xs">Forslaget ble avvist</p>
        );
      }
      return (
        <Confirmation approval={part.approval} state={part.state}>
          <ConfirmationRequest>
            <p className="font-medium text-sm">Legge til disse {noun}?</p>
            <ul className="flex flex-col gap-2">
              {proposalRows(part).map((row) => (
                <li key={row.name} className="flex flex-col gap-0.5">
                  <span className="flex items-center gap-2 text-sm">
                    {row.name}
                    {row.kind ? (
                      <Badge variant="outline">{KIND_LABELS[row.kind]}</Badge>
                    ) : null}
                  </span>
                  {row.detail ? (
                    <span className="text-muted-foreground text-xs">
                      {row.detail}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </ConfirmationRequest>
          <ConfirmationAccepted>
            <p className="text-muted-foreground text-xs">Legger til {noun}…</p>
          </ConfirmationAccepted>
          <ConfirmationRejected>
            <p className="text-muted-foreground text-xs">
              Forslaget ble avvist
            </p>
          </ConfirmationRejected>
          <ConfirmationActions>
            <ConfirmationAction
              variant="outline"
              onClick={() => onRespond(part.approval.id, false)}
            >
              Ikke ennå
            </ConfirmationAction>
            <ConfirmationAction
              onClick={() => onRespond(part.approval.id, true)}
            >
              Legg til
            </ConfirmationAction>
          </ConfirmationActions>
        </Confirmation>
      );
    case "output-available":
      return <p className="text-sm">{describeBatchResult(part.output)}</p>;
    case "output-error":
      return <p className="text-destructive text-xs">{part.errorText}</p>;
  }
}

function OnboardingMessage({
  message,
  isLatest,
  isStreaming,
  onRespond,
}: {
  message: OnboardingUIMessage;
  isLatest: boolean;
  isStreaming: boolean;
  onRespond: (approvalId: string, approved: boolean) => void;
}) {
  const isUser = message.role === "user";
  return (
    <Message from={message.role}>
      {message.parts.map((part, index) => {
        const key = `${message.id}-${index}`;
        if (part.type === "text") {
          if (!part.text) {
            return null;
          }
          return (
            <MessageContent key={key}>
              {isUser ? (
                <p className="whitespace-pre-wrap">{part.text}</p>
              ) : (
                <MessageResponse isAnimating={isLatest && isStreaming}>
                  {part.text}
                </MessageResponse>
              )}
            </MessageContent>
          );
        }
        if (isProposalPart(part)) {
          return (
            <ProposalCard
              key={key}
              part={part}
              isLatest={isLatest}
              onRespond={onRespond}
            />
          );
        }
        return null;
      })}
    </Message>
  );
}

export function OnboardingChat({
  onSetupChanged,
}: {
  onSetupChanged: () => void;
}) {
  const [input, setInput] = useState("");
  const announcedResults = useRef(new Set<string>());
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    messages,
    sendMessage,
    status,
    error,
    stop,
    regenerate,
    setMessages,
    clearError,
    addToolApprovalResponse,
  } = useChat<OnboardingUIMessage>({
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    onFinish: ({ message }) => {
      let changed = false;
      for (const part of message.parts) {
        if (
          isProposalPart(part) &&
          part.state === "output-available" &&
          !announcedResults.current.has(part.toolCallId)
        ) {
          announcedResults.current.add(part.toolCallId);
          changed = true;
          if (part.output.created.length > 0) {
            toast.success(`La til ${part.output.created.join(", ")}`);
          }
        }
      }
      if (changed) {
        onSetupChanged();
      }
    },
  });

  const busy = status === "submitted" || status === "streaming";

  function send(rawText: string) {
    const text = rawText.trim();
    if (!text || busy) {
      return;
    }
    void sendMessage({ text });
    setInput("");
  }

  function startNewConversation() {
    void stop();
    clearError();
    setMessages([]);
    setInput("");
    textareaRef.current?.focus();
  }

  function respondToProposal(approvalId: string, approved: boolean) {
    void addToolApprovalResponse({
      id: approvalId,
      approved,
      reason: approved ? undefined : PROPOSAL_DECLINED_REASON,
    });
  }

  return (
    <section
      aria-label="Samtale med oppsettsguiden"
      className="flex h-[70dvh] min-h-[28rem] flex-col overflow-hidden rounded-xl bg-card text-card-foreground text-sm ring-1 ring-foreground/10 lg:h-[calc(100dvh-14rem)]"
    >
      <header className="flex items-center gap-1 border-border border-b px-4 py-2">
        <h2 className="flex-1 font-semibold text-sm">Oppsettsguide</h2>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Ny samtale"
          title="Ny samtale"
          onClick={startNewConversation}
        >
          <SquarePen />
        </Button>
      </header>

      <Conversation className="min-h-0">
        <ConversationContent className="min-h-full gap-4 p-4">
          {messages.length === 0 ? (
            <ConversationEmptyState className="flex-1 items-start justify-end gap-3 p-0 text-left">
              <p className="max-w-prose text-muted-foreground text-sm">
                Jeg hjelper deg med å sette opp Inflation Station. Fortell meg
                hvilke bankkontoer du bruker, så legger jeg dem til. Deretter
                velger vi kategorier for forbruket ditt og en måte å holde
                overføringer mellom egne kontoer utenfor statistikken. Ingenting
                legges til før du godkjenner det.
              </p>
              <div className="flex flex-col items-start gap-1.5">
                {SUGGESTIONS.map((suggestion) => (
                  <Suggestion
                    key={suggestion}
                    suggestion={suggestion}
                    onClick={send}
                    className="h-auto whitespace-normal py-1.5 text-left"
                  />
                ))}
              </div>
            </ConversationEmptyState>
          ) : (
            messages.map((message, index) => (
              <OnboardingMessage
                key={message.id}
                message={message}
                isLatest={index === messages.length - 1}
                isStreaming={status === "streaming"}
                onRespond={respondToProposal}
              />
            ))
          )}
          {status === "submitted" ? (
            <p className="text-muted-foreground text-xs">Tenker…</p>
          ) : null}
          {error ? (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-destructive text-xs">
              <span className="flex-1">{describeChatError(error)}</span>
              <Button
                size="xs"
                variant="outline"
                onClick={() => void regenerate()}
              >
                <RotateCcw />
                Prøv igjen
              </Button>
            </div>
          ) : null}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-border border-t p-3">
        <PromptInput onSubmit={(message) => send(message.text)}>
          <PromptInputTextarea
            ref={textareaRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && busy) {
                event.preventDefault();
              }
            }}
            placeholder="Fortell guiden om kontoene eller forbruket ditt…"
            aria-label="Skriv til oppsettsguiden"
            rows={2}
            className="max-h-32 min-h-12"
          />
          <PromptInputFooter>
            <PromptInputTools />
            <PromptInputSubmit
              status={busy ? status : undefined}
              onStop={() => void stop()}
              aria-label={busy ? "Stopp svaret" : "Send melding"}
              disabled={!busy && !input.trim()}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </section>
  );
}
