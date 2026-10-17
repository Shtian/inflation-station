import type { CategoryKind } from "@prisma/client";
import { toast } from "sonner";

export type InlineCategory = {
  id: string;
  name: string;
};

type CreateCategoryOutcome =
  | { status: "created"; category: InlineCategory }
  | { status: "duplicate" }
  | { status: "failed" };

function readCreatedCategory(body: unknown): InlineCategory | null {
  if (typeof body !== "object" || body === null || !("category" in body)) {
    return null;
  }

  const { category } = body as { category: unknown };
  if (
    typeof category === "object" &&
    category !== null &&
    "id" in category &&
    "name" in category &&
    typeof category.id === "string" &&
    typeof category.name === "string"
  ) {
    return { id: category.id, name: category.name };
  }

  return null;
}

async function postCategory(
  name: string,
  kind: CategoryKind,
): Promise<CreateCategoryOutcome> {
  try {
    const response = await fetch("/api/categories", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, kind }),
    });
    const body: unknown = await response.json().catch(() => null);

    if (response.status === 201) {
      const category = readCreatedCategory(body);
      return category ? { status: "created", category } : { status: "failed" };
    }

    if (
      response.status === 409 &&
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      body.error === "CATEGORY_NAME_MUST_BE_UNIQUE"
    ) {
      return { status: "duplicate" };
    }

    return { status: "failed" };
  } catch {
    return { status: "failed" };
  }
}

type CreateCategoryInlineInput = {
  name: string;
  kind: CategoryKind;
  onCreated: (category: InlineCategory) => void;
  reloadCategories: () => Promise<readonly InlineCategory[]>;
};

export async function createCategoryInline({
  name,
  kind,
  onCreated,
  reloadCategories,
}: CreateCategoryInlineInput): Promise<InlineCategory | null> {
  const outcome = await postCategory(name, kind);

  switch (outcome.status) {
    case "created":
      onCreated(outcome.category);
      toast.success(`Kategorien «${outcome.category.name}» er opprettet`);
      return outcome.category;
    case "duplicate": {
      const wanted = name.toLowerCase();
      const fresh = await reloadCategories().catch(() => []);
      const existing = fresh.find(
        (category) => category.name.toLowerCase() === wanted,
      );
      if (existing) {
        return { id: existing.id, name: existing.name };
      }
      break;
    }
    case "failed":
      break;
  }

  toast.error("Kunne ikke opprette kategorien. Prøv igjen.");
  return null;
}
