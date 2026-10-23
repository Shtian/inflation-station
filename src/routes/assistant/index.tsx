import { createFileRoute } from "@tanstack/react-router";
import { AssistantChat } from "@/app/assistant/assistant-chat";
import {
  AssistantThreadHeader,
  AssistantThreadList,
  NewThreadLink,
} from "@/app/assistant/assistant-thread-list";
import {
  AssistantError,
  AssistantPending,
} from "./-components/assistant-route-states";
import { getAssistantPage } from "./-server";

function validateSearch(search: Record<string, unknown>): { thread?: string } {
  return typeof search.thread === "string" ? { thread: search.thread } : {};
}

export const Route = createFileRoute("/assistant/")({
  validateSearch,
  loaderDeps: ({ search }) => ({ thread: search.thread }),
  loader: ({ deps }) => getAssistantPage({ data: deps }),
  head: () => ({ meta: [{ title: "Innsikt · Inflation Station" }] }),
  pendingComponent: AssistantPending,
  errorComponent: AssistantError,
  component: AssistantPage,
});

function AssistantPage() {
  const { threadId, threads, activeThreadId, initialMessages } =
    Route.useLoaderData();

  return (
    <main className="flex h-svh min-h-0 flex-col lg:flex-row">
      <aside className="flex max-h-56 shrink-0 flex-col border-b border-border lg:max-h-none lg:w-72 lg:border-r lg:border-b-0">
        <div className="flex h-14 shrink-0 items-center gap-2 pr-2 pl-4">
          <h1 className="flex-1 text-base font-semibold tracking-tight text-foreground">
            Innsikt
          </h1>
          <NewThreadLink />
        </div>
        <AssistantThreadList
          threads={threads}
          activeThreadId={activeThreadId}
        />
      </aside>
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <AssistantThreadHeader
          thread={
            threads.find((thread) => thread.id === activeThreadId) ?? null
          }
        />
        <div className="min-h-0 flex-1">
          <AssistantChat
            threadId={threadId}
            initialMessages={initialMessages}
          />
        </div>
      </section>
    </main>
  );
}
