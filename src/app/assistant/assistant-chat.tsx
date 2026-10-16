"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ArrowUpRight, RotateCcw, SquarePen } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { getAssistantChatStatus } from "@/lib/assistant/chat-status";
import {
  ASSISTANT_CHAT_ENDPOINT,
  type AssistantDisabledReason,
  type AssistantUIMessage,
} from "@/lib/assistant/contract";
import { deriveTransactionLinks } from "./transaction-links";

const SUGGESTIONS = [
  "Hvor mye brukte jeg på dagligvarer forrige måned?",
  "Hvilke kategorier har jeg brukt mest på i år?",
  "Hva var de største kjøpene mine de siste 30 dagene?",
];

type Availability =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; disabledReason: AssistantDisabledReason | null };

const transport = new DefaultChatTransport<AssistantUIMessage>({
  api: ASSISTANT_CHAT_ENDPOINT,
});

function describeChatError(error: Error): string {
  if (error.message.includes("ASSISTANT_UNAVAILABLE")) {
    return "Chatten er ikke tilgjengelig på denne serveren akkurat nå.";
  }
  if (error.message.includes("INVALID_ASSISTANT_MESSAGES")) {
    return "Samtalen kunne ikke leses. Start en ny samtale.";
  }
  return "Fikk ikke svar fra chatten.";
}

function useAvailability() {
  const [availability, setAvailability] = useState<Availability>({
    status: "loading",
  });

  const reload = useCallback(async () => {
    setAvailability({ status: "loading" });
    try {
      const response = await fetch(ASSISTANT_CHAT_ENDPOINT);
      const body = (await response.json()) as {
        disabledReason?: AssistantDisabledReason | null;
      };
      setAvailability(
        response.ok && body.disabledReason !== undefined
          ? { status: "ready", disabledReason: body.disabledReason }
          : { status: "error" },
      );
    } catch {
      setAvailability({ status: "error" });
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { availability, reload };
}

function AssistantMessage({
  message,
  isAnimating,
}: {
  message: AssistantUIMessage;
  isAnimating: boolean;
}) {
  const isUser = message.role === "user";
  const transactionLinks =
    message.role === "assistant" && !isAnimating
      ? deriveTransactionLinks(message)
      : [];
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
                <MessageResponse isAnimating={isAnimating}>
                  {part.text}
                </MessageResponse>
              )}
            </MessageContent>
          );
        }
        return null;
      })}
      {transactionLinks.length > 0 ? (
        <ul className="flex flex-col items-start gap-1 text-xs">
          {transactionLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                {link.label}
                <ArrowUpRight aria-hidden className="size-3" />
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </Message>
  );
}

function AssistantConversation() {
  const [input, setInput] = useState("");
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
  } = useChat<AssistantUIMessage>({ transport });

  const busy = status === "submitted" || status === "streaming";
  const chatStatus = getAssistantChatStatus(status, messages);

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

  return (
    <section
      aria-label="Samtale om forbruket ditt"
      className="flex h-[70dvh] min-h-[28rem] flex-col overflow-hidden rounded-xl bg-card text-card-foreground text-sm ring-1 ring-foreground/10 lg:h-[calc(100dvh-14rem)]"
    >
      <header className="flex items-center gap-1 border-border border-b px-4 py-2">
        <h2 className="flex-1 font-semibold text-sm">Samtale</h2>
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
                Spør om forbruket ditt, så svarer jeg med tall hentet fra
                transaksjonene dine.
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
              <AssistantMessage
                key={message.id}
                message={message}
                isAnimating={
                  index === messages.length - 1 && status === "streaming"
                }
              />
            ))
          )}
          {chatStatus ? (
            <p className="text-muted-foreground text-xs">{chatStatus}</p>
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
            placeholder="Spør om forbruket ditt…"
            aria-label="Skriv et spørsmål"
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

export function AssistantChat() {
  const { availability, reload } = useAvailability();

  if (availability.status === "loading") {
    return (
      <p className="text-muted-foreground text-sm">
        Sjekker om chatten er tilgjengelig…
      </p>
    );
  }

  if (availability.status === "error") {
    return (
      <div className="flex items-center gap-2 text-destructive text-sm">
        <span>Kunne ikke sjekke om chatten er tilgjengelig.</span>
        <Button size="xs" variant="outline" onClick={() => void reload()}>
          Prøv igjen
        </Button>
      </div>
    );
  }

  if (availability.disabledReason === "key_missing") {
    return (
      <div className="flex flex-col gap-2 text-sm">
        <h2 className="font-medium text-foreground">
          Chatten er ikke tilgjengelig
        </h2>
        <p className="max-w-prose text-muted-foreground">
          Chatten trenger en OpenAI API-nøkkel (OPENAI_API_KEY) på serveren. Du
          kan fortsatt se forbruket ditt i oversikten, på transaksjonssiden og i
          månedsoppsummeringen.
        </p>
      </div>
    );
  }

  return <AssistantConversation />;
}
