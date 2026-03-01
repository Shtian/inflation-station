import { getDeterministicColorFromText } from "./deterministic-color";

const UNCATEGORIZED_LABEL = "uncategorized";

const UNCATEGORIZED_COLOR = {
  backgroundColor: "hsl(0 0% 68%)",
  borderColor: "hsl(0 0% 52%)",
  lightTextColor: "#161616",
  darkTextColor: "#161616",
};

export function getCategoryColor(label: string) {
  const normalized = label.trim().toLowerCase();

  if (normalized === UNCATEGORIZED_LABEL) {
    return UNCATEGORIZED_COLOR;
  }

  return getDeterministicColorFromText(label, "muted");
}
