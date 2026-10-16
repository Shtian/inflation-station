import { generateId } from "ai";
import { Separator } from "@/components/ui/separator";
import {
  assistantThreadIdSchema,
  getAssistantThread,
  listAssistantThreads,
} from "@/lib/assistant/threads";
import { prisma } from "@/lib/prisma";
import { AssistantChat } from "./assistant-chat";
import { AssistantThreadList } from "./assistant-thread-list";
import { formatThreadDate } from "./thread-date";

export const dynamic = "force-dynamic";

type AssistantPageProps = {
  searchParams: Promise<{ thread?: string | string[] }>;
};

export default async function AssistantPage({
  searchParams,
}: AssistantPageProps) {
  const requested = assistantThreadIdSchema.safeParse(
    (await searchParams).thread,
  );
  // An unknown but well-formed id keeps its id rather than getting a fresh
  // one: a new conversation puts its id in the URL before the server has
  // saved anything, and a refresh then must not remount the chat.
  const threadId = requested.success ? requested.data : generateId();
  const [threads, activeThread] = await Promise.all([
    listAssistantThreads(prisma),
    requested.success ? getAssistantThread(prisma, threadId) : null,
  ]);
  const now = new Date();

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 md:px-10">
      <div className="space-y-1">
        <h1 className="font-semibold text-2xl text-foreground tracking-tight">
          Innsikt
        </h1>
        <p className="text-muted-foreground text-sm">
          Still spørsmål om forbruket ditt. Svarene bygger på transaksjonene du
          har importert, og samtalene lagres slik at du kan fortsette senere.
        </p>
      </div>
      <Separator className="my-6" />
      <div className="grid gap-6 lg:grid-cols-[15rem_1fr]">
        <AssistantThreadList
          threads={threads.map((thread) => ({
            id: thread.id,
            title: thread.title,
            updatedAtLabel: formatThreadDate(thread.updatedAt, now),
          }))}
          activeThreadId={activeThread?.id ?? null}
        />
        <AssistantChat
          threadId={threadId}
          initialMessages={activeThread?.messages ?? []}
        />
      </div>
    </main>
  );
}
