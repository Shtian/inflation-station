import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import type { StatementItem } from "../../src/lib/import/pdf/statement-items";

const PAGE_WIDTH_PT = 595;
const PAGE_HEIGHT_PT = 842;
const PX_PER_PT = 96 / 72;
const BASE_FONT_PT = 8;

// extract-items glues neighbours closer than 0.6pt into one item, so a glyph
// run rendered wider than its source may swallow the next column. Each item is
// scaled down to clear that gap, which moves no x and changes no text.
const GLUE_GAP_PT = 0.6;
const COLUMN_CLEARANCE_PT = 2;

function escapeHtml(text: string): string {
  return text.replace(
    /[&<>]/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[char] ?? char,
  );
}

function buildHtml(items: StatementItem[]): string {
  const pages = [...new Set(items.map((item) => item.page))].sort(
    (a, b) => a - b,
  );

  const sections = pages
    .map((page) => {
      const cells = items
        .filter((item) => item.page === page)
        .map(
          (item) =>
            `<span class="cell" data-x="${item.x}" data-y="${item.y}">${escapeHtml(item.text)}<i class="baseline"></i></span>`,
        )
        .join("");
      return `<section class="page">${cells}</section>`;
    })
    .join("");

  return `<!doctype html><meta charset="utf-8"><style>
@page { size: ${PAGE_WIDTH_PT}pt ${PAGE_HEIGHT_PT}pt; margin: 0 }
html, body { margin: 0; padding: 0; background: #fff }
.page { position: relative; width: ${PAGE_WIDTH_PT}pt; height: ${PAGE_HEIGHT_PT}pt; overflow: hidden; break-after: page }
.page:last-child { break-after: auto }
.cell { position: absolute; left: 0; top: 0; white-space: pre; color: #000; font-family: Helvetica, Arial, sans-serif; font-size: ${BASE_FONT_PT}pt }
.baseline { display: inline-block; width: 0; height: 0 }
</style>${sections}`;
}

// An empty zero-height inline-block takes its baseline from its bottom margin
// edge, so its measured bottom is the line's baseline in CSS pixels. That is
// the only font-independent way to hit a PDF baseline, which is what pdfjs
// reports as an item's y.
function placeCells(constants: {
  pageHeightPt: number;
  pxPerPt: number;
  baseFontPt: number;
  minGapPt: number;
}): void {
  for (const section of document.querySelectorAll<HTMLElement>(".page")) {
    const pageRect = section.getBoundingClientRect();
    const cells = [...section.querySelectorAll<HTMLElement>(".cell")];

    const rows = new Map<string, HTMLElement[]>();
    for (const cell of cells) {
      const row = rows.get(cell.dataset.y ?? "");
      if (row) row.push(cell);
      else rows.set(cell.dataset.y ?? "", [cell]);
    }

    for (const row of rows.values()) {
      row.sort((a, b) => Number(a.dataset.x) - Number(b.dataset.x));
      for (let index = 0; index < row.length - 1; index += 1) {
        const available =
          (Number(row[index + 1].dataset.x) -
            Number(row[index].dataset.x) -
            constants.minGapPt) *
          constants.pxPerPt;
        const width = row[index].getBoundingClientRect().width;
        if (width > available) {
          row[index].style.fontSize =
            `${(constants.baseFontPt * available) / width}pt`;
        }
      }
    }

    for (const cell of cells) {
      const targetLeft =
        pageRect.left + Number(cell.dataset.x) * constants.pxPerPt;
      const targetBaseline =
        pageRect.top +
        (constants.pageHeightPt - Number(cell.dataset.y)) * constants.pxPerPt;
      const baseline = cell.querySelector(".baseline") as HTMLElement;
      cell.style.left = `${targetLeft - cell.getBoundingClientRect().left}px`;
      cell.style.top = `${targetBaseline - baseline.getBoundingClientRect().bottom}px`;
    }
  }
}

export async function renderStatementPdf(
  items: StatementItem[],
): Promise<Uint8Array> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.emulateMedia({ media: "print" });
    await page.setContent(buildHtml(items), { waitUntil: "load" });
    await page.evaluate(placeCells, {
      pageHeightPt: PAGE_HEIGHT_PT,
      pxPerPt: PX_PER_PT,
      baseFontPt: BASE_FONT_PT,
      minGapPt: GLUE_GAP_PT + COLUMN_CLEARANCE_PT,
    });

    // page.pdf resolves to a Buffer, which typechecks as a Uint8Array but which
    // unpdf rejects outright, so the copy is what makes the signature true.
    return new Uint8Array(
      await page.pdf({
        width: `${PAGE_WIDTH_PT / 0.75}px`,
        height: `${PAGE_HEIGHT_PT / 0.75}px`,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        preferCSSPageSize: true,
        printBackground: false,
      }),
    );
  } finally {
    await browser.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [source, destination] = process.argv.slice(2);
  const items = JSON.parse(await readFile(source, "utf8")) as StatementItem[];
  await writeFile(destination, await renderStatementPdf(items));
}
