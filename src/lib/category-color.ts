import { getDeterministicColorFromText } from "./deterministic-color";

export const UNCATEGORIZED_CATEGORY_NAME = "Ukategorisert";

const UNCATEGORIZED_COLOR = {
  backgroundColor: "oklch(72% 0 0)",
  borderColor: "oklch(58% 0 0)",
  lightTextColor: "#161616",
  darkTextColor: "#f5f5f5",
};

export function getCategoryColor(label: string) {
  const normalized = label.trim().toLowerCase();

  if (normalized === UNCATEGORIZED_CATEGORY_NAME.toLowerCase()) {
    return UNCATEGORIZED_COLOR;
  }

  return getDeterministicColorFromText(label, "muted");
}
