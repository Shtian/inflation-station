"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ArrowUpRight, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
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
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Suggestion } from "@/components/ai-elements/suggestion";
import { Button } from "@/components/ui/button";
import { getAssistantChatStatus } from "@/lib/assistant/chat-status";
import {
  ASSISTANT_CHAT_ENDPOINT,
  type AssistantChatAvailability,
  type AssistantChatOptions,
  type AssistantUIMessage,
  assistantChatAvailabilitySchema,
  readStoredAssistantChatOptions,
} from "@/lib/assistant/contract";
import { REASONING_EFFORTS } from "@/lib/monthly-review/reasoning-effort-registry";
import { cn } from "@/lib/utils";
import { deriveTransactionLinks } from "./transaction-links";

const SUGGESTIONS = [
  "Hvor mye brukte jeg på dagligvarer forrige måned?",
  "Hvilke kategorier har jeg brukt mest på i år?",
  "Hva var de største kjøpene mine de siste 30 dagene?",
];

const CHAT_OPTIONS_STORAGE_KEY = "assistant-chat-options";

const REASONING_EFFORT_ITEMS = REASONING_EFFORTS.map((effort) => ({
  value: effort.id,
  label: effort.label,
}));

type Availability =
  | { status: "loading" }
  | { status: "error" }
  | ({ status: "ready" } & AssistantChatAvailability);

const transport = new DefaultChatTransport<AssistantUIMessage>({
  api: ASSISTANT_CHAT_ENDPOINT,
  prepareSendMessagesRequest: ({ id, messages, body }) => ({
    body: { ...body, id, messages },
  }),
});

type ThreadProps = {
  threadId: string;
  initialMessages: AssistantUIMessage[];
};

type ModelChoices = Pick<
  AssistantChatAvailability,
  "availableModels" | "defaultModelId"
>;

function describeChatError(error: Error): string {
  if (error.message.includes("ASSISTANT_UNAVAILABLE")) {
    return "Chatten er ikke tilgjengelig på denne serveren akkurat nå.";
  }
  if (error.message.includes("INVALID_ASSISTANT_MESSAGES")) {
    return "Samtalen kunne ikke leses. Start en ny samtale.";
  }
  if (error.message.includes("INVALID_ASSISTANT_OPTIONS")) {
    return "Modellen eller tenkenivået er ikke gyldig. Velg på nytt.";
  }
  if (error.message.includes("UNSUPPORTED_REASONING_EFFORT")) {
    return "Modellen støtter ikke dette tenkenivået. Velg et annet.";
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
      const body = assistantChatAvailabilitySchema.safeParse(
        await response.json(),
      );
      setAvailability(
        response.ok && body.success
          ? { status: "ready", ...body.data }
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

function useChatOptions({ availableModels, defaultModelId }: ModelChoices) {
  // The conversation mounts only after the availability fetch, so this never
  // runs in the server render.
  const [options, setOptions] = useState<AssistantChatOptions>(() =>
    readStoredAssistantChatOptions(
      window.localStorage.getItem(CHAT_OPTIONS_STORAGE_KEY),
      { availableModels, defaultModelId },
    ),
  );

  function updateOptions(change: Partial<AssistantChatOptions>) {
    const next = { ...options, ...change };
    setOptions(next);
    window.localStorage.setItem(CHAT_OPTIONS_STORAGE_KEY, JSON.stringify(next));
  }

  return { options, updateOptions };
}

function ChatOptionsPicker({
  availableModels,
  options,
  onChange,
}: {
  availableModels: string[];
  options: AssistantChatOptions;
  onChange: (change: Partial<AssistantChatOptions>) => void;
}) {
  return (
    <>
      <PromptInputSelect
        items={availableModels.map((modelId) => ({
          value: modelId,
          label: modelId,
        }))}
        value={options.modelId}
        onValueChange={(value) => {
          if (typeof value === "string" && availableModels.includes(value)) {
            onChange({ modelId: value });
          }
        }}
      >
        <PromptInputSelectTrigger size="sm" aria-label="Velg modell">
          <PromptInputSelectValue />
        </PromptInputSelectTrigger>
        <PromptInputSelectContent>
          {availableModels.map((modelId) => (
            <PromptInputSelectItem key={modelId} value={modelId}>
              {modelId}
            </PromptInputSelectItem>
          ))}
        </PromptInputSelectContent>
      </PromptInputSelect>
      <PromptInputSelect
        items={REASONING_EFFORT_ITEMS}
        value={options.reasoningEffort}
        onValueChange={(value) => {
          const effort = REASONING_EFFORT_ITEMS.find(
            (item) => item.value === value,
          );
          if (effort) {
            onChange({ reasoningEffort: effort.value });
          }
        }}
      >
        <PromptInputSelectTrigger size="sm" aria-label="Velg tenkenivå">
          <PromptInputSelectValue />
        </PromptInputSelectTrigger>
        <PromptInputSelectContent>
          {REASONING_EFFORT_ITEMS.map((effort) => (
            <PromptInputSelectItem key={effort.value} value={effort.value}>
              {effort.label}
            </PromptInputSelectItem>
          ))}
        </PromptInputSelectContent>
      </PromptInputSelect>
    </>
  );
}

function AssistantConversation({
  threadId,
  initialMessages,
  availableModels,
  defaultModelId,
}: ThreadProps & ModelChoices) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const { options, updateOptions } = useChatOptions({
    availableModels,
    defaultModelId,
  });

  const { messages, sendMessage, status, error, stop, regenerate } =
    useChat<AssistantUIMessage>({
      id: threadId,
      messages: initialMessages,
      transport,
      onFinish: () => router.refresh(),
    });

  const busy = status === "submitted" || status === "streaming";
  const chatStatus = getAssistantChatStatus(status, messages);

  function send(rawText: string) {
    const text = rawText.trim();
    if (!text || busy) {
      return;
    }
    if (
      new URLSearchParams(window.location.search).get("thread") !== threadId
    ) {
      window.history.replaceState(null, "", `?thread=${threadId}`);
    }
    void sendMessage({ text }, { body: options });
    setInput("");
  }

  return (
    <section
      aria-label="Samtale om forbruket ditt"
      className="flex h-full min-h-0 flex-col overflow-hidden text-sm"
    >
      <Conversation className="min-h-0">
        <ConversationContent
          className={cn(
            "mx-auto min-h-full w-full max-w-3xl gap-6 px-6 pt-8 pb-4",
            // Streamdown wraps tables in a bordered card with a bordered
            // table inside; flatten it to plain rows on the chat surface.
            "[&_[data-streamdown=table-wrapper]]:gap-0 [&_[data-streamdown=table-wrapper]]:rounded-none [&_[data-streamdown=table-wrapper]]:border-0 [&_[data-streamdown=table-wrapper]]:bg-transparent [&_[data-streamdown=table-wrapper]]:p-0",
            "[&_[data-streamdown=table-wrapper]>div:last-child]:rounded-none [&_[data-streamdown=table-wrapper]>div:last-child]:border-0 [&_[data-streamdown=table-wrapper]>div:last-child]:bg-transparent",
            "[&_[data-streamdown=table-cell]]:pl-0 [&_[data-streamdown=table-cell]]:tabular-nums [&_[data-streamdown=table-header-cell]]:pl-0 [&_[data-streamdown=table-header-cell]]:font-medium [&_[data-streamdown=table-header-cell]]:text-muted-foreground [&_[data-streamdown=table-header-cell]]:text-xs [&_[data-streamdown=table-header]]:bg-transparent",
          )}
        >
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
                onClick={() => void regenerate({ body: options })}
              >
                <RotateCcw />
                Prøv igjen
              </Button>
            </div>
          ) : null}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="mx-auto w-full max-w-3xl px-6 pt-2 pb-5">
        <PromptInput onSubmit={(message) => send(message.text)}>
          <PromptInputTextarea
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
            <PromptInputTools>
              <ChatOptionsPicker
                availableModels={availableModels}
                options={options}
                onChange={updateOptions}
              />
            </PromptInputTools>
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

const STATE_COLUMN = "mx-auto w-full max-w-3xl px-6 pt-8";

export function AssistantChat({ threadId, initialMessages }: ThreadProps) {
  const { availability, reload } = useAvailability();

  if (availability.status === "loading") {
    return (
      <p className={cn(STATE_COLUMN, "text-muted-foreground text-sm")}>
        Sjekker om chatten er tilgjengelig…
      </p>
    );
  }

  if (availability.status === "error") {
    return (
      <div
        className={cn(
          STATE_COLUMN,
          "flex items-center gap-2 text-destructive text-sm",
        )}
      >
        <span>Kunne ikke sjekke om chatten er tilgjengelig.</span>
        <Button size="xs" variant="outline" onClick={() => void reload()}>
          Prøv igjen
        </Button>
      </div>
    );
  }

  if (availability.disabledReason === "key_missing") {
    return (
      <div
        className={cn(
          STATE_COLUMN,
          "flex h-full flex-col gap-8 overflow-y-auto pb-8 text-sm",
        )}
      >
        <div className="flex flex-col gap-2">
          <h2 className="font-medium text-foreground">
            Chatten er ikke tilgjengelig
          </h2>
          <p className="max-w-prose text-muted-foreground">
            Chatten trenger en OpenAI API-nøkkel (OPENAI_API_KEY) på serveren.
            Du kan fortsatt lese lagrede samtaler og se forbruket ditt i
            oversikten, på transaksjonssiden og i månedsoppsummeringen.
          </p>
        </div>
        {initialMessages.length > 0 ? (
          <section aria-label="Lagret samtale" className="flex flex-col gap-6">
            {initialMessages.map((message) => (
              <AssistantMessage
                key={message.id}
                message={message}
                isAnimating={false}
              />
            ))}
          </section>
        ) : null}
      </div>
    );
  }

  return (
    <AssistantConversation
      key={threadId}
      threadId={threadId}
      initialMessages={initialMessages}
      availableModels={availability.availableModels}
      defaultModelId={availability.defaultModelId}
    />
  );
}
