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
  code: "INVALID_AMOUNT" | "INVALID_BOOKING_DATE";
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
