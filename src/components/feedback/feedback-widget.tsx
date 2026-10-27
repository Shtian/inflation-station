"use client";

import {
  createChatClientOptions,
  fetchServerSentEvents,
  useChat,
} from "@tanstack/ai-react";
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
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createGithubIssueTool } from "@/lib/feedback/agent";
import {
  FEEDBACK_CHAT_ENDPOINT,
  type PickedElement,
  readFeedbackMetadata,
} from "@/lib/feedback/contract";
import { type DraftView, draftView } from "@/lib/feedback/draft-view";
import { cn } from "@/lib/utils";

const DRAFT_DECLINED_REASON =
  "The user clicked Ikke ennå (Not yet). Nothing failed; they want to change the draft.";

type WidgetView = "closed" | "chat" | "picking";

function chatOptions(threadId: string) {
  return createChatClientOptions({
    connection: fetchServerSentEvents(FEEDBACK_CHAT_ENDPOINT),
    threadId,
    tools: [createGithubIssueTool],
  });
}

function useFeedbackChat(threadId: string) {
  return useChat(chatOptions(threadId));
}

type FeedbackChat = ReturnType<typeof useFeedbackChat>;

type FeedbackMessage = FeedbackChat["messages"][number];

type DraftApproval = Extract<
  FeedbackChat["interrupts"][number],
  { kind: "tool-approval" }
>;

const EXAMPLE_PROMPTS = [
  "Noe på denne siden ser feil ut",
  "Jeg har en idé til en ny funksjon",
  "En knapp gjør ikke det jeg forventer",
];

function describeChatError(error: Error): string {
  const status = "status" in error ? error.status : undefined;
  if (status === 503) {
    return "Tilbakemelding er ikke satt opp på denne serveren akkurat nå.";
  }
  if (status === 400) {
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

function IssueDraftPart({ view }: { view: DraftView<DraftApproval> }) {
  switch (view.kind) {
    case "writing":
      return (
        <p className="text-xs text-muted-foreground">Skriver utkast til sak…</p>
      );
    case "awaiting": {
      const { approval } = view;
      const draft = approval.originalArgs;
      return (
        <Alert className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Badge variant={draft.kind === "bug" ? "destructive" : "secondary"}>
              {draft.kind === "bug" ? "Feil" : "Funksjon"}
            </Badge>
            <span className="text-sm font-medium">{draft.title}</span>
          </div>
          <div className="max-h-48 overflow-y-auto rounded-md bg-muted/50 p-2 text-xs [&_h1]:text-sm [&_h2]:text-sm [&_h3]:text-xs">
            <MessageResponse>{draft.body}</MessageResponse>
          </div>
          <p className="text-xs text-muted-foreground">
            Sidekontekst og valgte elementer legges ved.
          </p>
          <div className="flex items-center justify-end gap-2 self-end">
            <Button
              type="button"
              variant="outline"
              className="h-8 px-3 text-sm"
              onClick={() =>
                approval.resolveInterrupt(false, {
                  payload: { reason: DRAFT_DECLINED_REASON },
                })
              }
            >
              Ikke ennå
            </Button>
            <Button
              type="button"
              className="h-8 px-3 text-sm"
              onClick={() => approval.resolveInterrupt(true, {})}
            >
              Opprett sak
            </Button>
          </div>
        </Alert>
      );
    }
    case "creating":
      return <p className="text-xs text-muted-foreground">Oppretter sak…</p>;
    case "declined":
    case "superseded":
      return (
        <p className="text-xs text-muted-foreground">Utkastet ble forkastet</p>
      );
    case "created":
      return (
        <p className="text-sm">
          Opprettet sak{" "}
          <a
            href={view.issue.url}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-brand underline underline-offset-2"
          >
            #{view.issue.number}
          </a>
        </p>
      );
    case "failed":
      return <p className="text-xs text-destructive">{view.error}</p>;
  }
}

function FeedbackMessageView({
  message,
  isLatest,
  isStreaming,
  approvals,
}: {
  message: FeedbackMessage;
  isLatest: boolean;
  isStreaming: boolean;
  approvals: DraftApproval[];
}) {
  if (message.role !== "user" && message.role !== "assistant") {
    return null;
  }
  const isUser = message.role === "user";
  const element = readFeedbackMetadata(message)?.element;
  return (
    <Message from={message.role}>
      {isUser && element ? (
        <ElementChip element={element} className="self-end" />
      ) : null}
      {message.parts.map((part, index) => {
        const key = `${message.id}-${index}`;
        if (part.type === "text") {
          if (!part.content) {
            return null;
          }
          return (
            <MessageContent key={key}>
              {isUser ? (
                <p className="whitespace-pre-wrap">{part.content}</p>
              ) : (
                <MessageResponse isAnimating={isLatest && isStreaming}>
                  {part.content}
                </MessageResponse>
              )}
            </MessageContent>
          );
        }
        if (part.type === "tool-call" && part.name === "createGithubIssue") {
          const view = draftView({
            call: part,
            result: message.parts.find(
              (
                other,
              ): other is Extract<typeof other, { type: "tool-result" }> =>
                other.type === "tool-result" && other.toolCallId === part.id,
            ),
            pending: approvals.find(
              (approval) => approval.toolCallId === part.id,
            ),
            streaming: isLatest && isStreaming,
          });
          return <IssueDraftPart key={key} view={view} />;
        }
        return null;
      })}
    </Message>
  );
}

function createdIssues(messages: readonly FeedbackMessage[]) {
  return messages.flatMap((message) =>
    message.parts.flatMap((part) =>
      part.type === "tool-call" &&
      part.name === "createGithubIssue" &&
      part.output
        ? [{ toolCallId: part.id, issue: part.output }]
        : [],
    ),
  );
}

export function FeedbackWidget() {
  const [view, setView] = useState<WidgetView>("closed");
  const [input, setInput] = useState("");
  const [pendingElement, setPendingElement] = useState<PickedElement | null>(
    null,
  );
  const [threadId, setThreadId] = useState(() => crypto.randomUUID());
  const announcedIssues = useRef(new Set<string>());
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { messages, sendMessage, status, error, stop, reload, interrupts } =
    useFeedbackChat(threadId);
  const approvals = interrupts.filter(
    (interrupt): interrupt is DraftApproval =>
      interrupt.kind === "tool-approval",
  );

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    for (const { toolCallId, issue } of createdIssues(messages)) {
      if (!announcedIssues.current.has(toolCallId)) {
        announcedIssues.current.add(toolCallId);
        toast.success(`Sak #${issue.number} opprettet`);
      }
    }
  }, [messages]);

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
    const supersedesDraft = approvals.length > 0;
    if (supersedesDraft) {
      stop();
    }
    void sendMessage({
      content: text,
      metadata: {
        pathname: `${window.location.pathname}${window.location.search}`,
        ...(pendingElement ? { element: pendingElement } : {}),
      },
    });
    setInput("");
    setPendingElement(null);
  }

  function startNewConversation() {
    setThreadId(crypto.randomUUID());
    setInput("");
    setPendingElement(null);
    textareaRef.current?.focus();
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
        // Escape closes the panel from whichever control inside it has focus.
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
        <section
          aria-label="Tilbakemelding"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setView("closed");
            }
          }}
          className="fixed inset-x-3 bottom-20 z-feedback flex h-[min(520px,calc(100dvh-7rem))] flex-col overflow-hidden rounded-xl bg-card text-sm text-card-foreground shadow-xl ring-1 ring-foreground/10 sm:inset-x-auto sm:right-5 sm:w-[380px]"
        >
          <header className="flex items-center gap-1 border-b border-border px-3 py-2">
            <h2 className="flex-1 text-sm font-semibold">Tilbakemelding</h2>
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
                  <p className="text-sm text-muted-foreground">
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
                  <FeedbackMessageView
                    key={message.id}
                    message={message}
                    isLatest={index === messages.length - 1}
                    isStreaming={status === "streaming"}
                    approvals={approvals}
                  />
                ))
              )}
              {status === "submitted" ? (
                <p className="text-xs text-muted-foreground">Tenker…</p>
              ) : null}
              {error ? (
                <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  <span className="flex-1">{describeChatError(error)}</span>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => void reload()}
                  >
                    <RotateCcw />
                    Prøv igjen
                  </Button>
                </div>
              ) : null}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          <div className="border-t border-border p-3">
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
                  onStop={() => stop()}
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
