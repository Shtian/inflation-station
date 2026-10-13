import type { Account, Category } from "./categories-manager.types";

export const GLOBAL_SCOPE_VALUE = "__global__";
export const ANY_PAYMENT_TYPE_VALUE = "__any__";

export function getCategoryMutationErrorMessage(status: number, body: unknown) {
  if (typeof body === "object" && body && "error" in body) {
    const code = String((body as { error: unknown }).error);

    if (status === 404 && code === "CATEGORY_NOT_FOUND") {
      return "Fant ikke den valgte kategorien.";
    }

    if (status === 404 && code === "CATEGORY_RULE_NOT_FOUND") {
      return "Fant ikke den valgte kategoriregelen.";
    }

    if (status === 409 && code === "CATEGORY_NAME_MUST_BE_UNIQUE") {
      return "Det finnes allerede en kategori med dette navnet i dette omfanget.";
    }

    if (status === 400 && code === "INVALID_CATEGORY_PAYLOAD") {
      return "Ugyldige kategoridata.";
    }

    if (status === 400 && code === "INVALID_CATEGORY_RULE_PAYLOAD") {
      return "Ugyldige data for kategoriregel.";
    }

    if (status === 404 && code === "CATEGORY_OR_ACCOUNT_NOT_FOUND") {
      return "Fant ikke den valgte kategorien eller kontoen.";
    }
  }

  return "Forespørselen mislyktes. Prøv igjen.";
}

export function getScopeLabel(accountId: string | null, accounts: Account[]) {
  if (!accountId) {
    return "Alle kontoer";
  }

  return accounts.find((account) => account.id === accountId)?.name ?? "Ukjent";
}

export function hasClassifierHint(
  category: Pick<Category, "classifierHint">,
): boolean {
  return (category.classifierHint?.trim() ?? "") !== "";
}
