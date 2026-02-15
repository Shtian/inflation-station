const REQUIRED_HEADERS = [
  "bookingDate",
  "amount",
  "sender",
  "recipient",
  "name",
  "title",
  "currency",
  "paymentType",
] as const;

const HEADER_ALIASES: Record<(typeof REQUIRED_HEADERS)[number], string[]> = {
  bookingDate: ["Bokforingsdato", "Bokføringsdato", "BookingDate"],
  amount: ["Belop", "Beløp", "Amount"],
  sender: ["Avsender", "Sender"],
  recipient: ["Mottaker", "Recipient"],
  name: ["Navn", "Name"],
  title: ["Tittel", "Title"],
  currency: ["Valuta", "Currency"],
  paymentType: ["Betalingstype", "PaymentType"],
};

export type ParsedCsvRow = {
  bookingDate: string;
  amountNok: number;
  currency: "NOK";
  sender: string;
  recipient: string;
  name: string;
  title: string;
  paymentType: string;
};

export type CsvValidationError = {
  rowNumber: number;
  code:
    | "MISSING_REQUIRED_HEADERS"
    | "INVALID_COLUMN_COUNT"
    | "INVALID_AMOUNT"
    | "INVALID_CURRENCY";
  message: string;
};

export type CsvParserResult = {
  rows: ParsedCsvRow[];
  errors: CsvValidationError[];
  summary: {
    imported: number;
    duplicates: number;
    ignoredReserved: number;
    invalid: number;
  };
};

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replaceAll("ø", "o")
    .replaceAll("æ", "ae")
    .replaceAll("å", "a")
    .replaceAll(/[^a-z0-9]/g, "");
}

function parseDelimitedLine(line: string): string[] {
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

    if (char === ";" && !inQuotes) {
      cells.push(value.trim());
      value = "";
      continue;
    }

    value += char;
  }

  cells.push(value.trim());
  return cells;
}

function parseNokAmount(value: string): number | null {
  const normalized = value
    .replaceAll(/\s/g, "")
    .replaceAll(".", "")
    .replace(",", ".");
  const numeric = Number.parseFloat(normalized);

  if (!Number.isFinite(numeric)) {
    return null;
  }

  return numeric;
}

function isReservedBookingDate(value: string): boolean {
  return value.trim().toLowerCase() === "reservert";
}

type HeaderMap = Record<(typeof REQUIRED_HEADERS)[number], number>;

function buildHeaderMap(headerLine: string): HeaderMap | null {
  const headerCells = parseDelimitedLine(headerLine);
  const normalizedHeaders = headerCells.map((cell) => normalizeHeader(cell));

  const map = {} as HeaderMap;

  for (const requiredHeader of REQUIRED_HEADERS) {
    const aliases = HEADER_ALIASES[requiredHeader].map((alias) =>
      normalizeHeader(alias),
    );
    const columnIndex = normalizedHeaders.findIndex((header) =>
      aliases.includes(header),
    );

    if (columnIndex === -1) {
      return null;
    }

    map[requiredHeader] = columnIndex;
  }

  return map;
}

export function parseNorwegianBankCsv(csvContent: string): CsvParserResult {
  const lines = csvContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return {
      rows: [],
      errors: [
        {
          rowNumber: 1,
          code: "MISSING_REQUIRED_HEADERS",
          message:
            "CSV is empty. Expected headers include Bokføringsdato, Beløp, Valuta and Betalingstype.",
        },
      ],
      summary: {
        imported: 0,
        duplicates: 0,
        ignoredReserved: 0,
        invalid: 1,
      },
    };
  }

  const headerMap = buildHeaderMap(lines[0]);

  if (!headerMap) {
    return {
      rows: [],
      errors: [
        {
          rowNumber: 1,
          code: "MISSING_REQUIRED_HEADERS",
          message:
            "Missing required CSV headers. Expected Bokføringsdato, Beløp, Avsender, Mottaker, Navn, Tittel, Valuta, Betalingstype.",
        },
      ],
      summary: {
        imported: 0,
        duplicates: 0,
        ignoredReserved: 0,
        invalid: 1,
      },
    };
  }

  const rows: ParsedCsvRow[] = [];
  const errors: CsvValidationError[] = [];
  let ignoredReserved = 0;

  for (let index = 1; index < lines.length; index += 1) {
    const rowNumber = index + 1;
    const cells = parseDelimitedLine(lines[index]);

    if (cells.length < Object.keys(headerMap).length) {
      errors.push({
        rowNumber,
        code: "INVALID_COLUMN_COUNT",
        message: `Row ${rowNumber} has too few columns for the expected semicolon format.`,
      });
      continue;
    }

    const bookingDate = cells[headerMap.bookingDate];
    if (isReservedBookingDate(bookingDate)) {
      ignoredReserved += 1;
      continue;
    }

    const amountValue = cells[headerMap.amount];
    const amountNok = parseNokAmount(amountValue);

    if (amountNok === null) {
      errors.push({
        rowNumber,
        code: "INVALID_AMOUNT",
        message: `Row ${rowNumber} has invalid amount "${amountValue}". Expected Norwegian decimal format like 123,45.`,
      });
      continue;
    }

    const currency = cells[headerMap.currency].toUpperCase();
    if (currency !== "NOK") {
      errors.push({
        rowNumber,
        code: "INVALID_CURRENCY",
        message: `Row ${rowNumber} has unsupported currency "${cells[headerMap.currency]}". Only NOK is accepted.`,
      });
      continue;
    }

    rows.push({
      bookingDate,
      amountNok,
      currency: "NOK",
      sender: cells[headerMap.sender],
      recipient: cells[headerMap.recipient],
      name: cells[headerMap.name],
      title: cells[headerMap.title],
      paymentType: cells[headerMap.paymentType],
    });
  }

  return {
    rows,
    errors,
    summary: {
      imported: rows.length,
      duplicates: 0,
      ignoredReserved,
      invalid: errors.length,
    },
  };
}
