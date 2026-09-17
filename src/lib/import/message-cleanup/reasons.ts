export type CleanupDisabledReason = "disabled" | "key_missing";

export type ChunkFailureReason = "timeout" | "provider_error";

export type MessageCleanupUnavailableReason =
  | CleanupDisabledReason
  | ChunkFailureReason;
