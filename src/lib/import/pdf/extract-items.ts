import { getDocumentProxy } from "unpdf";
import type { StatementItem } from "./statement-items";

const Y_TOLERANCE = 2;
const GLUE_GAP = 0.6;

type PositionedItem = StatementItem & { width: number };

type PositionedLine = {
  page: number;
  y: number;
  items: PositionedItem[];
};

async function readPositionedItems(
  bytes: Uint8Array,
): Promise<PositionedItem[]> {
  const pdf = await getDocumentProxy(bytes);
  const items: PositionedItem[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();

    for (const item of content.items) {
      if (!("str" in item) || item.str.trim() === "") continue;
      items.push({
        page: pageNumber,
        x: item.transform[4],
        y: item.transform[5],
        width: item.width,
        text: item.str,
      });
    }
  }

  return items;
}

function groupPositionedLines(items: PositionedItem[]): PositionedLine[] {
  const lines: PositionedLine[] = [];

  for (const item of [...items].sort(
    (a, b) => a.page - b.page || b.y - a.y || a.x - b.x,
  )) {
    const last = lines.at(-1);
    if (
      last &&
      last.page === item.page &&
      Math.abs(last.y - item.y) <= Y_TOLERANCE
    ) {
      last.items.push(item);
      continue;
    }
    lines.push({ page: item.page, y: item.y, items: [item] });
  }

  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x);
  }
  return lines;
}

// pdfjs emits ligatures as separate items, so "Spesifikasjon" arrives as
// "Spesi" + "fi" + "kasjon". Re-glue anything with no measurable gap.
function glueLineItems(items: PositionedItem[]): PositionedItem[] {
  const glued: PositionedItem[] = [];

  for (const item of items) {
    const last = glued.at(-1);
    if (last && item.x - (last.x + last.width) < GLUE_GAP) {
      last.text += item.text;
      last.width = item.x + item.width - last.x;
      continue;
    }
    glued.push({ ...item });
  }

  return glued
    .map((item) => ({ ...item, text: item.text.trim() }))
    .filter((item) => item.text !== "");
}

export async function extractStatementItems(
  bytes: Uint8Array,
): Promise<StatementItem[]> {
  const lines = groupPositionedLines(await readPositionedItems(bytes));

  return lines.flatMap((line) =>
    glueLineItems(line.items).map((item) => ({
      page: line.page,
      // groupStatementLines keys on an exact page:y match, so every item swept
      // into one line has to carry that line's single snapped integer y. The
      // column constants in both providers are calibrated against integer x.
      y: Math.round(line.y),
      x: Math.round(item.x),
      text: item.text,
    })),
  );
}
