import { getDocumentProxy } from "unpdf";
import {
  glueLineItems,
  groupPositionedLines,
  type PositionedItem,
  type StatementItem,
} from "./statement-items";

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
