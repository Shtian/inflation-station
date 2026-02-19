import type { Account } from "./categories-manager.types";

export const GLOBAL_SCOPE_VALUE = "__global__";
export const ANY_PAYMENT_TYPE_VALUE = "__any__";

export function getCategoryMutationErrorMessage(status: number, body: unknown) {
  if (typeof body === "object" && body && "error" in body) {
    const code = String((body as { error: unknown }).error);

    if (status === 404 && code === "CATEGORY_NOT_FOUND") {
      return "Selected category was not found.";
    }

    if (status === 404 && code === "CATEGORY_RULE_NOT_FOUND") {
      return "Selected category rule was not found.";
    }

    if (status === 409 && code === "CATEGORY_NAME_MUST_BE_UNIQUE") {
      return "A category with this name already exists for this scope.";
    }

    if (status === 400 && code === "INVALID_CATEGORY_PAYLOAD") {
      return "Invalid category payload.";
    }

    if (status === 400 && code === "INVALID_CATEGORY_RULE_PAYLOAD") {
      return "Invalid category rule payload.";
    }

    if (status === 404 && code === "CATEGORY_OR_ACCOUNT_NOT_FOUND") {
      return "Selected category or account was not found.";
    }
  }

  return "Request failed. Please try again.";
}

export function getScopeLabel(accountId: string | null, accounts: Account[]) {
  if (!accountId) {
    return "Global";
  }

  return (
    accounts.find((account) => account.id === accountId)?.name ?? "Unknown"
  );
}
