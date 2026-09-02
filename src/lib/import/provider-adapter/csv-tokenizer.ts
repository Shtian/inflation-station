/**
 * Shared CSV lexical layer owned by the provider-adapter module. Handles
 * semicolon and comma delimiters, quoted delimiters, escaped double quotes,
 * CRLF/LF input, and blank lines. Detection and parsing both consume this
 * module so delimiter and quoting fixes are made once.
 */

export type CsvDelimiter = ";" | ",";

export const SUPPORTED_CSV_DELIMITERS: readonly CsvDelimiter[] = [";", ","];

export type TokenizedCsv = {
  delimiter: CsvDelimiter;
  headerLine: string;
  headerCells: string[];
  /** Trimmed, non-blank content lines following the header line, in file order. */
  dataLines: string[];
};

/**
 * Splits a single CSV line into cells for the given delimiter, honoring
 * double-quoted cells (which may themselves contain the delimiter) and
 * doubled-quote escaping ("" -> ").
 */
export function parseDelimitedLine(
  line: string,
  delimiter: CsvDelimiter,
): string[] {
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

function countCells(line: string, delimiter: CsvDelimiter): number {
  return parseDelimitedLine(line, delimiter).length;
}

/**
 * Resolves which delimiter a header line uses. An explicit delimiter (from a
 * mapping's normalization rules) always wins; automatic inference is used
 * only when the mapping omits one, and picks whichever supported delimiter
 * produces more cells (ties favor semicolon, matching prior behavior).
 */
export function resolveDelimiter(
  headerLine: string,
  explicitDelimiter?: CsvDelimiter,
): CsvDelimiter {
  if (explicitDelimiter) {
    return explicitDelimiter;
  }

  const semicolonCells = countCells(headerLine, ";");
  const commaCells = countCells(headerLine, ",");

  return semicolonCells >= commaCells ? ";" : ",";
}

function splitLines(content: string): string[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function isLikelyHeaderLine(line: string): boolean {
  const hasLetter = /[a-zA-ZæøåÆØÅ]/.test(line);
  const hasSupportedDelimiter = line.includes(";") || line.includes(",");

  return hasLetter && hasSupportedDelimiter;
}

/**
 * Produces one shared tokenized view of a CSV: it skips blank lines and any
 * non-header preamble, locates the header row the same way for both
 * detection and parsing, and splits it (and the following content lines)
 * using one resolved delimiter. Returns null when no header-like line can be
 * found (e.g. an empty file).
 */
export function tokenizeCsv(
  content: string,
  explicitDelimiter?: CsvDelimiter,
): TokenizedCsv | null {
  const lines = splitLines(content);
  const headerIndex = lines.findIndex((line) => isLikelyHeaderLine(line));

  if (headerIndex === -1) {
    return null;
  }

  const headerLine = lines[headerIndex];
  const delimiter = resolveDelimiter(headerLine, explicitDelimiter);
  const headerCells = parseDelimitedLine(headerLine, delimiter);
  const dataLines = lines.slice(headerIndex + 1);

  return { delimiter, headerLine, headerCells, dataLines };
}
