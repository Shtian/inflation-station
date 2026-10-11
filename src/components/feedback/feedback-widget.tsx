"use client";

import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from "ai";
import {
  ArrowUp,
  MessageSquarePlus,
  RotateCcw,
  Square,
  SquareDashedMousePointer,
  SquarePen,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ElementPickerOverlay } from "@/components/feedback/element-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import {
  FEEDBACK_CHAT_ENDPOINT,
  type FeedbackUIMessage,
  type PickedElement,
} from "@/lib/feedback/contract";
import { cn } from "@/lib/utils";

type WidgetView = "closed" | "chat" | "picking";

type IssueToolPart = Extract<
  FeedbackUIMessage["parts"][number],
  { type: "tool-createGithubIssue" }
>;

const transport = new DefaultChatTransport<FeedbackUIMessage>({
  api: FEEDBACK_CHAT_ENDPOINT,
});

const EXAMPLE_PROMPTS = [
  "Something on this page looks wrong",
  "I have an idea for a new feature",
  "A button doesn't do what I expect",
];

function describeChatError(error: Error): string {
  if (error.message.includes("FEEDBACK_UNAVAILABLE")) {
    return "Feedback isn't set up on this server right now.";
  }
  if (error.message.includes("INVALID_FEEDBACK_MESSAGES")) {
    return "This conversation couldn't be read. Start a new conversation.";
  }
  return "Couldn't reach the feedback assistant.";
}

function elementLabel(element: PickedElement): string {
  return element.label ?? (element.text || element.selector);
}

function ElementChip({
  element,
  onRemove,
}: {
  element: PickedElement;
  onRemove?: () => void;
}) {
  return (
    <span
      title={element.selector}
      className="inline-flex max-w-full items-center gap-1 rounded-md bg-brand/10 px-1.5 py-0.5 font-mono text-[11px] text-brand"
    >
      <SquareDashedMousePointer className="size-3 shrink-0" />
      <span className="truncate">
        &lt;{element.tagName}&gt; {elementLabel(element)}
      </span>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove attached element"
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
      return <p className="text-muted-foreground text-xs">Drafting issue…</p>;
    case "approval-requested":
      // A reply typed instead of a button press supersedes the draft (the
      // server sends it to the model as denied).
      if (!isLatest) {
        return <p className="text-muted-foreground text-xs">Draft dismissed</p>;
      }
      return (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-background p-3">
          <div className="flex items-center gap-2">
            <Badge
              variant={part.input.kind === "bug" ? "destructive" : "secondary"}
            >
              {part.input.kind === "bug" ? "Bug" : "Feature"}
            </Badge>
            <span className="font-medium text-sm">{part.input.title}</span>
          </div>
          <div className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md bg-muted/50 p-2 text-xs">
            {part.input.body}
          </div>
          <p className="text-muted-foreground text-xs">
            Page context and selected elements will be attached.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onRespond(part.approval.id, false)}
            >
              Not yet
            </Button>
            <Button size="sm" onClick={() => onRespond(part.approval.id, true)}>
              Create issue
            </Button>
          </div>
        </div>
      );
    case "approval-responded":
      return (
        <p className="text-muted-foreground text-xs">
          {part.approval.approved ? "Creating issue…" : "Draft dismissed"}
        </p>
      );
    case "output-available":
      return (
        <p className="text-sm">
          Created issue{" "}
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
    case "output-denied":
      return <p className="text-muted-foreground text-xs">Draft dismissed</p>;
    case "output-error":
      return <p className="text-destructive text-xs">{part.errorText}</p>;
  }
}

function MessageBubble({
  message,
  isLatest,
  onRespond,
}: {
  message: FeedbackUIMessage;
  isLatest: boolean;
  onRespond: (approvalId: string, approved: boolean) => void;
}) {
  const isUser = message.role === "user";
  const element = message.metadata?.element;
  return (
    <div
      className={cn(
        "flex max-w-[85%] flex-col gap-1.5",
        isUser ? "items-end self-end" : "items-start self-start",
      )}
    >
      {isUser && element ? <ElementChip element={element} /> : null}
      {message.parts.map((part, index) => {
        const key = `${message.id}-${index}`;
        if (part.type === "text") {
          return part.text ? (
            <div
              key={key}
              className={cn(
                "whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm",
                isUser
                  ? "rounded-br-sm bg-brand text-brand-foreground"
                  : "rounded-bl-sm bg-muted text-foreground",
              )}
            >
              {part.text}
            </div>
          ) : null;
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
    </div>
  );
}

export function FeedbackWidget() {
  const [view, setView] = useState<WidgetView>("closed");
  const [input, setInput] = useState("");
  const [pendingElement, setPendingElement] = useState<PickedElement | null>(
    null,
  );
  const announcedIssues = useRef(new Set<string>());
  const scrollRef = useRef<HTMLDivElement>(null);
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
          toast.success(`Issue #${part.output.number} created`);
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-runs on every message or status change so streamed text stays in view.
  useEffect(() => {
    const container = scrollRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, status]);

  function send() {
    const text = input.trim();
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
    void addToolApprovalResponse({ id: approvalId, approved });
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
          aria-label={view === "chat" ? "Close feedback" : "Give feedback"}
          aria-expanded={view === "chat"}
          onClick={() => setView(view === "chat" ? "closed" : "chat")}
          className="fixed right-5 bottom-5 z-feedback size-12 rounded-full bg-brand text-brand-foreground shadow-lg hover:bg-brand/90 [&_svg:not([class*='size-'])]:size-5"
        >
          {view === "chat" ? <X /> : <MessageSquarePlus />}
        </Button>
      )}

      {view === "chat" ? (
        <section
          aria-label="Feedback"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setView("closed");
            }
          }}
          className="fixed inset-x-3 bottom-20 z-feedback flex h-[min(520px,calc(100dvh-7rem))] flex-col overflow-hidden rounded-xl bg-card text-card-foreground text-sm shadow-xl ring-1 ring-foreground/10 sm:inset-x-auto sm:right-5 sm:w-[380px]"
        >
          <header className="flex items-center gap-1 border-border border-b px-3 py-2">
            <h2 className="flex-1 font-semibold text-sm">Feedback</h2>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="New conversation"
              title="New conversation"
              onClick={startNewConversation}
            >
              <SquarePen />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Close feedback"
              onClick={() => setView("closed")}
            >
              <X />
            </Button>
          </header>

          <div
            ref={scrollRef}
            className="flex flex-1 flex-col gap-3 overflow-y-auto px-3 py-3"
          >
            {messages.length === 0 ? (
              <div className="flex flex-1 flex-col justify-center gap-3">
                <p className="text-muted-foreground text-sm">
                  Found a bug or have an idea? Describe it and I'll turn it into
                  an issue for the developer.
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
              </div>
            ) : (
              messages.map((message, index) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isLatest={index === messages.length - 1}
                  onRespond={respondToDraft}
                />
              ))
            )}
            {status === "submitted" ? (
              <p className="text-muted-foreground text-xs">Thinking…</p>
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
                  Retry
                </Button>
              </div>
            ) : null}
          </div>

          <div className="border-border border-t p-3">
            <InputGroup>
              {pendingElement ? (
                <InputGroupAddon align="block-start">
                  <ElementChip
                    element={pendingElement}
                    onRemove={() => setPendingElement(null)}
                  />
                </InputGroupAddon>
              ) : null}
              <InputGroupTextarea
                ref={textareaRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    send();
                  }
                }}
                placeholder="Describe the bug or idea…"
                aria-label="Feedback message"
                rows={2}
                className="max-h-32 min-h-12"
              />
              <InputGroupAddon align="block-end" className="justify-between">
                <InputGroupButton
                  size="xs"
                  aria-label="Pick an element on the page"
                  onClick={() => setView("picking")}
                >
                  <SquareDashedMousePointer />
                  Pick element
                </InputGroupButton>
                {busy ? (
                  <InputGroupButton
                    size="icon-xs"
                    variant="outline"
                    aria-label="Stop response"
                    onClick={() => void stop()}
                  >
                    <Square />
                  </InputGroupButton>
                ) : (
                  <InputGroupButton
                    size="icon-xs"
                    variant="default"
                    aria-label="Send feedback"
                    disabled={!input.trim()}
                    onClick={send}
                  >
                    <ArrowUp />
                  </InputGroupButton>
                )}
              </InputGroupAddon>
            </InputGroup>
          </div>
        </section>
      ) : null}
    </div>
  );
}
