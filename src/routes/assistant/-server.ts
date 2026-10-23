import { createServerFn } from "@tanstack/react-start";
import { generateId } from "ai";
import { deleteAssistantThreadAction } from "@/app/actions/delete-assistant-thread";
import { renameAssistantThreadAction } from "@/app/actions/rename-assistant-thread";
import { formatThreadDate } from "@/app/assistant/thread-date";
import {
  assistantThreadIdSchema,
  getAssistantThread,
  listAssistantThreads,
} from "@/lib/assistant/threads";
import { prisma } from "@/lib/prisma";

// Tool parts type their input `unknown`, which fails the strict
// serializable-output check, though stored messages are plain JSON.
export const getAssistantPage = createServerFn({
  method: "GET",
  strict: { output: false },
})
  .validator((input: { thread?: string }) => input)
  .handler(async ({ data }) => {
    const requested = assistantThreadIdSchema.safeParse(data.thread);
    // An unknown but well-formed id keeps its id rather than getting a fresh
    // one: a new conversation puts its id in the URL before the server has
    // saved anything, and a refresh then must not remount the chat.
    const threadId = requested.success ? requested.data : generateId();
    const [threads, activeThread] = await Promise.all([
      listAssistantThreads(prisma),
      requested.success ? getAssistantThread(prisma, threadId) : null,
    ]);
    const now = new Date();

    return {
      threadId,
      threads: threads.map((thread) => ({
        id: thread.id,
        title: thread.title,
        updatedAtLabel: formatThreadDate(thread.updatedAt, now),
      })),
      activeThreadId: activeThread?.id ?? null,
      initialMessages: activeThread?.messages ?? [],
    };
  });

// Validation stays in the shared mutation so the error contract matches the
// Next action; see `trips/-server.ts` for why output is not strict.
const passThrough = (input: unknown) => input;

export const deleteAssistantThreadFn = createServerFn({
  method: "POST",
  strict: { output: false },
})
  .validator(passThrough)
  .handler(({ data }) => deleteAssistantThreadAction(data));

export const renameAssistantThreadFn = createServerFn({
  method: "POST",
  strict: { output: false },
})
  .validator(passThrough)
  .handler(({ data }) => renameAssistantThreadAction(data));
