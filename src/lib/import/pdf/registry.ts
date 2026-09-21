import { amexPdfStatementExtractor } from "./providers/amex";
import { trumfPdfStatementExtractor } from "./providers/trumf";
import type { PdfStatementExtraction, StatementItem } from "./statement-items";

export type PdfStatementExtractor = {
  readonly providerId: string;
  readonly providerName: string;
  detect(items: StatementItem[]): boolean;
  extract(items: StatementItem[]): PdfStatementExtraction;
};

export const PDF_STATEMENT_EXTRACTORS: readonly PdfStatementExtractor[] = [
  trumfPdfStatementExtractor,
  amexPdfStatementExtractor,
];

export function detectPdfStatementExtractor(
  items: StatementItem[],
): PdfStatementExtractor | null {
  return (
    PDF_STATEMENT_EXTRACTORS.find((extractor) => extractor.detect(items)) ??
    null
  );
}
