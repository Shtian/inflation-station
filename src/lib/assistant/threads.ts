import type { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import type { AssistantUIMessage } from "./contract";

export const ASSISTANT_THREAD_TITLE_MAX_LENGTH = 80;
const DERIVED_TITLE_MAX_LENGTH = 60;
const FALLBACK_TITLE = "Ny samtale";

export const assistantThreadIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/);

export const assistantThreadTitleSchema = z
  .string()
  .trim()
  .min(1)
  .max(ASSISTANT_THREAD_TITLE_MAX_LENGTH);

export type AssistantThreadSummary = {
  id: string;
  title: string;
  updatedAt: Date;
};

export type AssistantThread = {
  id: string;
  title: string;
  messages: AssistantUIMessage[];
};

export function deriveAssistantThreadTitle(
  messages: readonly AssistantUIMessage[],
): string {
  const firstUserText = messages
    .find((message) => message.role === "user")
    ?.parts.find((part) => part.type === "text")?.text;
  const text = firstUserText?.replace(/\s+/g, " ").trim() ?? "";

  if (!text) {
    return FALLBACK_TITLE;
  }
  if (text.length <= DERIVED_TITLE_MAX_LENGTH) {
    return text;
  }
  return `${text.slice(0, DERIVED_TITLE_MAX_LENGTH - 1).trimEnd()}…`;
}

export function listAssistantThreads(
  db: PrismaClient,
): Promise<AssistantThreadSummary[]> {
  return db.assistantThread.findMany({
    select: { id: true, title: true, updatedAt: true },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
  });
}

export async function getAssistantThread(
  db: PrismaClient,
  id: string,
): Promise<AssistantThread | null> {
  const thread = await db.assistantThread.findUnique({
    where: { id },
    select: { id: true, title: true, messages: true },
  });
  if (!thread) {
    return null;
  }
  // Only saveAssistantThreadMessages writes this column, and the chat route
  // validates every message before it reaches that function.
  return {
    ...thread,
    messages: thread.messages as unknown as AssistantUIMessage[],
  };
}

export async function saveAssistantThreadMessages(
  db: PrismaClient,
  id: string,
  messages: AssistantUIMessage[],
): Promise<void> {
  const storedMessages = messages as unknown as Prisma.InputJsonArray;
  await db.assistantThread.upsert({
    where: { id },
    create: {
      id,
      title: deriveAssistantThreadTitle(messages),
      messages: storedMessages,
    },
    update: { messages: storedMessages },
  });
}

export async function renameAssistantThread(
  db: PrismaClient,
  id: string,
  title: string,
): Promise<void> {
  // The list is ordered by the last saved turn, so a rename keeps updatedAt.
  const existing = await db.assistantThread.findUnique({
    where: { id },
    select: { updatedAt: true },
  });
  await db.assistantThread.update({
    where: { id },
    data: { title, updatedAt: existing?.updatedAt },
  });
}

export async function deleteAssistantThread(
  db: PrismaClient,
  id: string,
): Promise<void> {
  await db.assistantThread.delete({ where: { id } });
}
