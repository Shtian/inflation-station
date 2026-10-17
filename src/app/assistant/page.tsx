import { generateId } from "ai";
import {
  assistantThreadIdSchema,
  getAssistantThread,
  listAssistantThreads,
} from "@/lib/assistant/threads";
import { prisma } from "@/lib/prisma";
import { AssistantChat } from "./assistant-chat";
import {
  AssistantThreadHeader,
  AssistantThreadList,
  NewThreadLink,
} from "./assistant-thread-list";
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
  const threadItems = threads.map((thread) => ({
    id: thread.id,
    title: thread.title,
    updatedAtLabel: formatThreadDate(thread.updatedAt, now),
  }));
  const activeThreadId = activeThread?.id ?? null;

  return (
    <main className="flex h-svh min-h-0 flex-col lg:flex-row">
      <aside className="flex max-h-56 shrink-0 flex-col border-border border-b lg:max-h-none lg:w-72 lg:border-r lg:border-b-0">
        <div className="flex h-14 shrink-0 items-center gap-2 pr-2 pl-4">
          <h1 className="flex-1 font-semibold text-base text-foreground tracking-tight">
            Innsikt
          </h1>
          <NewThreadLink />
        </div>
        <AssistantThreadList
          threads={threadItems}
          activeThreadId={activeThreadId}
        />
      </aside>
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <AssistantThreadHeader
          thread={
            threadItems.find((thread) => thread.id === activeThreadId) ?? null
          }
        />
        <div className="min-h-0 flex-1">
          <AssistantChat
            threadId={threadId}
            initialMessages={activeThread?.messages ?? []}
          />
        </div>
      </section>
    </main>
  );
}
