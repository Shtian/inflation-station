import { foldLocaleCharacters } from "../normalization";

export type CsvDelimiter = ";" | ",";

export type TokenizedCsvRow = {
  /** 1-based line number in the original file, counting blank lines. */
  sourceRowNumber: number;
  cells: string[];
};

export type TokenizedCsv = {
  delimiter: CsvDelimiter;
  /** First non-blank line that looks like a header, or null. */
  headerRow: TokenizedCsvRow | null;
  /** headerRow cells run through normalizeCsvHeader, index-aligned. */
  normalizedHeaders: string[];
  /** Non-blank rows after headerRow. */
  dataRows: TokenizedCsvRow[];
};

/**
 * A decoded statement that memoizes tokenization per delimiter so detection and
 * parsing observe identical cells for the same delimiter.
 */
export type CsvStatement = {
  readonly content: string;
  readonly inferredDelimiter: CsvDelimiter;
  tokenize(delimiter?: CsvDelimiter): TokenizedCsv;
};

const HEADER_LETTER_PATTERN = /[a-zA-ZæøåÆØÅ]/;

/** Folds Nordic characters, lowercases, strips every non-alphanumeric character. */
export function normalizeCsvHeader(value: string): string {
  return foldLocaleCharacters(value)
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]/g, "");
}

function isLikelyHeaderLine(line: string): boolean {
  return HEADER_LETTER_PATTERN.test(line);
}

// A quoted cell may not span lines in v1 — statements are single-line records.
function splitDelimitedLine(line: string, delimiter: CsvDelimiter): string[] {
  const cells: string[] = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        value += '"';
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      cells.push(value.trim());
      value = "";
      continue;
    }

    value += char;
  }

  cells.push(value.trim());
  return cells;
}

export function tokenizeCsv(
  content: string,
  delimiter: CsvDelimiter,
): TokenizedCsv {
  const lines = content.split(/\r\n|\n/);

  let headerRow: TokenizedCsvRow | null = null;
  const dataRows: TokenizedCsvRow[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const trimmedLine = lines[index].trim();

    if (trimmedLine.length === 0) {
      continue;
    }

    const sourceRowNumber = index + 1;

    if (!headerRow) {
      if (isLikelyHeaderLine(trimmedLine)) {
        headerRow = {
          sourceRowNumber,
          cells: splitDelimitedLine(trimmedLine, delimiter),
        };
      }
      continue;
    }

    dataRows.push({
      sourceRowNumber,
      cells: splitDelimitedLine(trimmedLine, delimiter),
    });
  }

  const normalizedHeaders = headerRow
    ? headerRow.cells.map((cell) => normalizeCsvHeader(cell))
    : [];

  return {
    delimiter,
    headerRow,
    normalizedHeaders,
    dataRows,
  };
}

export function inferCsvDelimiter(content: string): CsvDelimiter {
  const semicolonHeaderCellCount =
    tokenizeCsv(content, ";").headerRow?.cells.length ?? 0;
  const commaHeaderCellCount =
    tokenizeCsv(content, ",").headerRow?.cells.length ?? 0;

  return semicolonHeaderCellCount >= commaHeaderCellCount ? ";" : ",";
}

export function createCsvStatement(content: string): CsvStatement {
  const inferredDelimiter = inferCsvDelimiter(content);
  const tokenizedByDelimiter = new Map<CsvDelimiter, TokenizedCsv>();

  return {
    content,
    inferredDelimiter,
    tokenize(delimiter: CsvDelimiter = inferredDelimiter): TokenizedCsv {
      const cached = tokenizedByDelimiter.get(delimiter);
      if (cached) {
        return cached;
      }

      const tokenized = tokenizeCsv(content, delimiter);
      tokenizedByDelimiter.set(delimiter, tokenized);
      return tokenized;
    },
  };
}
