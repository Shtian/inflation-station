"use client";

import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from "ai";
import {
  MessageSquarePlus,
  RotateCcw,
  SquareDashedMousePointer,
  SquarePen,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  PromptInputButton,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { ElementPickerOverlay } from "@/components/feedback/element-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FEEDBACK_CHAT_ENDPOINT,
  type FeedbackUIMessage,
  type PickedElement,
} from "@/lib/feedback/contract";
import { cn } from "@/lib/utils";

const DRAFT_DECLINED_REASON =
  "The user clicked Ikke ennå (Not yet). Nothing failed; they want to change the draft.";

type WidgetView = "closed" | "chat" | "picking";

type IssueToolPart = Extract<
  FeedbackUIMessage["parts"][number],
  { type: "tool-createGithubIssue" }
>;

const transport = new DefaultChatTransport<FeedbackUIMessage>({
  api: FEEDBACK_CHAT_ENDPOINT,
});

const EXAMPLE_PROMPTS = [
  "Noe på denne siden ser feil ut",
  "Jeg har en idé til en ny funksjon",
  "En knapp gjør ikke det jeg forventer",
];

function describeChatError(error: Error): string {
  if (error.message.includes("FEEDBACK_UNAVAILABLE")) {
    return "Tilbakemelding er ikke satt opp på denne serveren akkurat nå.";
  }
  if (error.message.includes("INVALID_FEEDBACK_MESSAGES")) {
    return "Samtalen kunne ikke leses. Start en ny samtale.";
  }
  return "Fikk ikke kontakt med tilbakemeldingsassistenten.";
}

function elementLabel(element: PickedElement): string {
  return element.label ?? (element.text || element.selector);
}

function ElementChip({
  element,
  onRemove,
  className,
}: {
  element: PickedElement;
  onRemove?: () => void;
  className?: string;
}) {
  return (
    <span
      title={element.selector}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-md bg-brand/10 px-1.5 py-0.5 font-mono text-[11px] text-brand",
        className,
      )}
    >
      <SquareDashedMousePointer className="size-3 shrink-0" />
      <span className="truncate">
        &lt;{element.tagName}&gt; {elementLabel(element)}
      </span>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Fjern vedlagt element"
          className="rounded-sm hover:bg-brand/20"
        >
          <X className="size-3" />
        </button>
      ) : null}
    </span>
  );
}

function IssueDraftPart({
  part,
  isLatest,
  onRespond,
}: {
  part: IssueToolPart;
  isLatest: boolean;
  onRespond: (approvalId: string, approved: boolean) => void;
}) {
  switch (part.state) {
    case "input-streaming":
    case "input-available":
      return (
        <p className="text-muted-foreground text-xs">Skriver utkast til sak…</p>
      );
    case "approval-requested":
    case "approval-responded":
    case "output-denied":
      // A reply typed instead of a button press supersedes the draft (the
      // server sends it to the model as denied).
      if (part.state === "approval-requested" && !isLatest) {
        return (
          <p className="text-muted-foreground text-xs">
            Utkastet ble forkastet
          </p>
        );
      }
      return (
        <Confirmation approval={part.approval} state={part.state}>
          <ConfirmationRequest>
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  part.input.kind === "bug" ? "destructive" : "secondary"
                }
              >
                {part.input.kind === "bug" ? "Feil" : "Funksjon"}
              </Badge>
              <span className="font-medium text-sm">{part.input.title}</span>
            </div>
            <div className="max-h-48 overflow-y-auto rounded-md bg-muted/50 p-2 text-xs [&_h1]:text-sm [&_h2]:text-sm [&_h3]:text-xs">
              <MessageResponse>{part.input.body}</MessageResponse>
            </div>
            <p className="text-muted-foreground text-xs">
              Sidekontekst og valgte elementer legges ved.
            </p>
          </ConfirmationRequest>
          <ConfirmationAccepted>
            <p className="text-muted-foreground text-xs">Oppretter sak…</p>
          </ConfirmationAccepted>
          <ConfirmationRejected>
            <p className="text-muted-foreground text-xs">
              Utkastet ble forkastet
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
              Opprett sak
            </ConfirmationAction>
          </ConfirmationActions>
        </Confirmation>
      );
    case "output-available":
      return (
        <p className="text-sm">
          Opprettet sak{" "}
          <a
            href={part.output.url}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-brand underline underline-offset-2"
          >
            #{part.output.number}
          </a>
        </p>
      );
    case "output-error":
      return <p className="text-destructive text-xs">{part.errorText}</p>;
  }
}

function FeedbackMessage({
  message,
  isLatest,
  isStreaming,
  onRespond,
}: {
  message: FeedbackUIMessage;
  isLatest: boolean;
  isStreaming: boolean;
  onRespond: (approvalId: string, approved: boolean) => void;
}) {
  const isUser = message.role === "user";
  const element = message.metadata?.element;
  return (
    <Message from={message.role}>
      {isUser && element ? (
        <ElementChip element={element} className="self-end" />
      ) : null}
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
        if (part.type === "tool-createGithubIssue") {
          return (
            <IssueDraftPart
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

export function FeedbackWidget() {
  const [view, setView] = useState<WidgetView>("closed");
  const [input, setInput] = useState("");
  const [pendingElement, setPendingElement] = useState<PickedElement | null>(
    null,
  );
  const announcedIssues = useRef(new Set<string>());
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
  } = useChat<FeedbackUIMessage>({
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    onFinish: ({ message }) => {
      for (const part of message.parts) {
        if (
          part.type === "tool-createGithubIssue" &&
          part.state === "output-available" &&
          !announcedIssues.current.has(part.toolCallId)
        ) {
          announcedIssues.current.add(part.toolCallId);
          toast.success(`Sak #${part.output.number} opprettet`);
        }
      }
    },
  });

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (view === "chat") {
      textareaRef.current?.focus();
    }
  }, [view]);

  function send(rawText: string) {
    const text = rawText.trim();
    if (!text || busy) {
      return;
    }
    void sendMessage({
      text,
      metadata: {
        pathname: `${window.location.pathname}${window.location.search}`,
        ...(pendingElement ? { element: pendingElement } : {}),
      },
    });
    setInput("");
    setPendingElement(null);
  }

  function startNewConversation() {
    void stop();
    clearError();
    setMessages([]);
    setInput("");
    setPendingElement(null);
    textareaRef.current?.focus();
  }

  function respondToDraft(approvalId: string, approved: boolean) {
    void addToolApprovalResponse({
      id: approvalId,
      approved,
      reason: approved ? undefined : DRAFT_DECLINED_REASON,
    });
  }

  function onPick(element: PickedElement) {
    setPendingElement(element);
    setView("chat");
  }

  function onCancelPick() {
    setView("chat");
  }

  return (
    <div data-feedback-widget>
      {view === "picking" ? (
        <ElementPickerOverlay onPick={onPick} onCancel={onCancelPick} />
      ) : (
        <Button
          size="icon-lg"
          aria-label={
            view === "chat" ? "Lukk tilbakemelding" : "Gi tilbakemelding"
          }
          aria-expanded={view === "chat"}
          onClick={() => setView(view === "chat" ? "closed" : "chat")}
          className="fixed right-5 bottom-5 z-feedback size-12 rounded-full bg-brand text-brand-foreground shadow-lg hover:bg-brand/90 [&_svg:not([class*='size-'])]:size-5"
        >
          {view === "chat" ? <X /> : <MessageSquarePlus />}
        </Button>
      )}

      {view === "chat" ? (
        <section
          aria-label="Tilbakemelding"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setView("closed");
            }
          }}
          className="fixed inset-x-3 bottom-20 z-feedback flex h-[min(520px,calc(100dvh-7rem))] flex-col overflow-hidden rounded-xl bg-card text-card-foreground text-sm shadow-xl ring-1 ring-foreground/10 sm:inset-x-auto sm:right-5 sm:w-[380px]"
        >
          <header className="flex items-center gap-1 border-border border-b px-3 py-2">
            <h2 className="flex-1 font-semibold text-sm">Tilbakemelding</h2>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Ny samtale"
              title="Ny samtale"
              onClick={startNewConversation}
            >
              <SquarePen />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Lukk tilbakemelding"
              onClick={() => setView("closed")}
            >
              <X />
            </Button>
          </header>

          <Conversation className="min-h-0">
            <ConversationContent className="min-h-full gap-4 p-3">
              {messages.length === 0 ? (
                <ConversationEmptyState className="flex-1 items-start gap-3 p-0 text-left">
                  <p className="text-muted-foreground text-sm">
                    Har du funnet en feil eller fått en idé? Beskriv den, så
                    gjør jeg den om til en sak for utvikleren.
                  </p>
                  <div className="flex flex-col items-start gap-1.5">
                    {EXAMPLE_PROMPTS.map((prompt) => (
                      <Button
                        key={prompt}
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setInput(prompt);
                          textareaRef.current?.focus();
                        }}
                      >
                        {prompt}
                      </Button>
                    ))}
                  </div>
                </ConversationEmptyState>
              ) : (
                messages.map((message, index) => (
                  <FeedbackMessage
                    key={message.id}
                    message={message}
                    isLatest={index === messages.length - 1}
                    isStreaming={status === "streaming"}
                    onRespond={respondToDraft}
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
              {pendingElement ? (
                <PromptInputHeader>
                  <ElementChip
                    element={pendingElement}
                    onRemove={() => setPendingElement(null)}
                  />
                </PromptInputHeader>
              ) : null}
              <PromptInputTextarea
                ref={textareaRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  // PromptInput resets the form on every submit; skip it while
                  // a reply is in flight so the draft text survives.
                  if (event.key === "Enter" && !event.shiftKey && busy) {
                    event.preventDefault();
                  }
                }}
                placeholder="Beskriv feilen eller idéen…"
                aria-label="Din tilbakemelding"
                rows={2}
                className="max-h-32 min-h-12"
              />
              <PromptInputFooter>
                <PromptInputTools>
                  <PromptInputButton
                    size="xs"
                    aria-label="Velg et element på siden"
                    onClick={() => setView("picking")}
                  >
                    <SquareDashedMousePointer />
                    Velg element
                  </PromptInputButton>
                </PromptInputTools>
                <PromptInputSubmit
                  // "error" would swap the send arrow for an X; the error
                  // row below already offers Retry.
                  status={busy ? status : undefined}
                  onStop={() => void stop()}
                  aria-label={busy ? "Stopp svaret" : "Send tilbakemelding"}
                  disabled={!busy && !input.trim()}
                />
              </PromptInputFooter>
            </PromptInput>
          </div>
        </section>
      ) : null}
    </div>
  );
}
