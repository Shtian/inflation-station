import type { InferUITools, UIMessage } from "ai";
import { z } from "zod";
import type { createFeedbackTools } from "./agent";

export const FEEDBACK_CHAT_ENDPOINT = "/api/feedback/chat";

export const pickedElementSchema = z.object({
  selector: z.string().max(500),
  tagName: z.string().max(40),
  label: z.string().max(200).nullable(),
  text: z.string().max(300),
  html: z.string().max(1000),
});

export type PickedElement = z.infer<typeof pickedElementSchema>;

export const feedbackMessageMetadataSchema = z.object({
  pathname: z.string().max(500),
  element: pickedElementSchema.optional(),
});

export type FeedbackMessageMetadata = z.infer<
  typeof feedbackMessageMetadataSchema
>;

export const issueDraftSchema = z.object({
  kind: z.enum(["bug", "feature"]),
  title: z.string().min(5).max(120),
  body: z.string().min(10).max(6000),
});

export type IssueDraft = z.infer<typeof issueDraftSchema>;

export type CreatedIssue = { number: number; url: string };

export type FeedbackUITools = InferUITools<
  ReturnType<typeof createFeedbackTools>
>;

export type FeedbackUIMessage = UIMessage<
  FeedbackMessageMetadata,
  never,
  FeedbackUITools
>;

export type FeedbackDisabledReason =
  | "key_missing"
  | "repo_missing"
  | "token_missing";
