import { normalizeMerchantKey } from "@/lib/transactions/merchant";
import type { HistoryMerchant } from "./category-merchants";
import { LEGAL_SUFFIXES } from "./merchant-family";

export const HINT_SOFT_LIMIT = 200;

const SUGGESTED_MERCHANT_COUNT = 6;

export type HintMerchant = Pick<HistoryMerchant, "key" | "label">;

export type HintSegment = { start: number; end: number; raw: string };

export type MerchantPresence = "on" | "mentioned" | "off";

export type MerchantChipResult =
  | { kind: "text"; text: string }
  | { kind: "note"; message: string };

type Separator = { index: number; char: string };

export function splitHint(text: string): HintSegment[] {
  const segments: HintSegment[] = [];
  let pieceStart = 0;
  const closePiece = (pieceEnd: number) => {
    const raw = text.slice(pieceStart, pieceEnd);
    const trimmedStart = raw.length - raw.trimStart().length;
    const trimmed = raw.trim();
    if (trimmed.length > 0) {
      const start = pieceStart + trimmedStart;
      segments.push({ start, end: start + trimmed.length, raw: trimmed });
    }
  };

  for (const separator of topLevelSeparators(text)) {
    closePiece(separator.index);
    pieceStart = separator.index + 1;
  }
  closePiece(text.length);
  return segments;
}

function topLevelSeparators(text: string): Separator[] {
  const separators: Separator[] = [];
  let depth = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth = Math.max(0, depth - 1);
    } else if (depth === 0 && isSeparatorAt(text, index)) {
      separators.push({ index, char });
    }
  }
  return separators;
}

function isSeparatorAt(text: string, index: number): boolean {
  const char = text[index];
  if (char === ",") {
    return true;
  }
  return /[.:;]/.test(char) && /\s/.test(text[index + 1] ?? "");
}

export function merchantCore(value: string): string {
  const words = normalizeMerchantKey(value).split(" ");
  while (words.length > 0) {
    const last = words[words.length - 1];
    if (/^\d*$/.test(last) || LEGAL_SUFFIXES.has(last)) {
      words.pop();
    } else {
      break;
    }
  }
  return words.join(" ");
}

function isMerchantSegment(segment: HintSegment, merchant: HintMerchant) {
  const segmentCore = merchantCore(segment.raw);
  return (
    segmentCore.length > 0 &&
    (segmentCore === merchantCore(merchant.label) ||
      segmentCore === merchant.key)
  );
}

export function merchantPresence(
  text: string,
  merchant: HintMerchant,
): MerchantPresence {
  if (splitHint(text).some((segment) => isMerchantSegment(segment, merchant))) {
    return "on";
  }
  const padded = ` ${normalizeMerchantKey(text)} `;
  const mentioned = [normalizeMerchantKey(merchant.label), merchant.key].some(
    (needle) => needle.length > 0 && padded.includes(` ${needle} `),
  );
  return mentioned ? "mentioned" : "off";
}

export function applyMerchantChip(
  text: string,
  merchant: HintMerchant,
): MerchantChipResult {
  const presence = merchantPresence(text, merchant);
  if (presence === "mentioned") {
    return {
      kind: "note",
      message: `“${merchant.label}” is part of your own wording. Edit the text to change it.`,
    };
  }
  if (presence === "off") {
    return { kind: "text", text: appendMerchant(text, merchant.label) };
  }

  let next = text;
  let segment = findMerchantSegment(next, merchant);
  while (segment) {
    next = removeSegment(next, segment);
    segment = findMerchantSegment(next, merchant);
  }
  return { kind: "text", text: next };
}

function appendMerchant(text: string, label: string): string {
  const stripped = text.replace(/[\s,.;:]+$/, "");
  if (stripped.length === 0) {
    return label;
  }
  const terminator = text.slice(stripped.length).match(/[.;:]/)?.[0];
  return terminator
    ? `${stripped}${terminator} ${label}`
    : `${stripped}, ${label}`;
}

function findMerchantSegment(text: string, merchant: HintMerchant) {
  return splitHint(text).find((segment) =>
    isMerchantSegment(segment, merchant),
  );
}

function removeSegment(text: string, segment: HintSegment): string {
  const after = text.slice(segment.end).match(/^\s*,\s*/);
  if (after) {
    return (
      text.slice(0, segment.start) + text.slice(segment.end + after[0].length)
    );
  }
  const before = text.slice(0, segment.start).match(/\s*,\s*$/);
  if (before) {
    return (
      text.slice(0, segment.start - before[0].length) + text.slice(segment.end)
    );
  }
  const space = text.slice(0, segment.start).match(/(?<=[.;:])\s+$/);
  const start = space ? segment.start - space[0].length : segment.start;
  return text.slice(0, start) + text.slice(segment.end);
}

export function namesAnyMerchant(
  text: string,
  merchants: readonly HintMerchant[],
): boolean {
  return merchants.some(
    (merchant) => merchantPresence(text, merchant) !== "off",
  );
}

export function hasLeadingDescription(
  text: string,
  description: string,
): boolean {
  const rest = text.trimStart();
  if (!rest.startsWith(description)) {
    return false;
  }
  const next = rest[description.length];
  const afterPeriod = rest[description.length + 1];
  return (
    next === undefined ||
    (next === "." && (afterPeriod === undefined || /\s/.test(afterPeriod)))
  );
}

// The description is a leading sentence closed by ".", so appendMerchant and
// removeSegment treat it as a terminator and chips never merge into it.
export function setLeadingDescription(
  text: string,
  description: string,
  on: boolean,
): string {
  const has = hasLeadingDescription(text, description);
  if (on) {
    if (has) {
      return text;
    }
    return text.trim() === "" ? `${description}.` : `${description}. ${text}`;
  }
  if (!has) {
    return text;
  }
  const rest = text.trimStart();
  const leadingWhitespace = text.slice(0, text.length - rest.length);
  const after = rest.slice(description.length).replace(/^\./, "");
  return leadingWhitespace + after.replace(/^\s/, "");
}

export function suggestHintText(
  merchants: readonly HintMerchant[],
  description: string | null,
): string {
  const list = merchants
    .slice(0, SUGGESTED_MERCHANT_COUNT)
    .map((merchant) => merchant.label)
    .join(", ");
  return description ? setLeadingDescription(list, description, true) : list;
}

export function formatJevCategoryLine(
  name: string,
  hint: string | null,
): string {
  return hint ? `${name}: ${hint}` : name;
}
