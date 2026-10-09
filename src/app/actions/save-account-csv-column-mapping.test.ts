import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveAccountCsvColumnMappingAction } from "./save-account-csv-column-mapping";

const { accountUpdateMock } = vi.hoisted(() => ({
  accountUpdateMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { account: { update: accountUpdateMock } },
}));

const DNB_HEADERS = [
  "Dato",
  "Forklaring",
  "Rentedato",
  "Ut fra konto",
  "Inn på konto",
];

const DNB_MAPPING = {
  date: { index: 0, header: "Dato" },
  amount: {
    kind: "split",
    inflow: { index: 4, header: "Inn på konto" },
    outflow: { index: 3, header: "Ut fra konto" },
  },
  description: [{ index: 1, header: "Forklaring" }],
};

describe("saveAccountCsvColumnMappingAction", () => {
  beforeEach(() => {
    accountUpdateMock.mockReset();
    accountUpdateMock.mockResolvedValue({ id: "account-1" });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("stores the mapping and the file's header signature on the account", async () => {
    const result = await saveAccountCsvColumnMappingAction({
      accountId: "account-1",
      headers: DNB_HEADERS,
      mapping: DNB_MAPPING,
    });

    expect(result).toEqual({
      ok: true,
      data: {
        accountId: "account-1",
        csvHeaderSignature: "dato|forklaring|rentedato|utfrakonto|innpakonto",
      },
    });
    expect(accountUpdateMock).toHaveBeenCalledWith({
      where: { id: "account-1" },
      data: {
        csvColumnMapping: DNB_MAPPING,
        csvHeaderSignature: "dato|forklaring|rentedato|utfrakonto|innpakonto",
      },
    });
  });

  it("rejects a payload without headers before touching the database", async () => {
    const result = await saveAccountCsvColumnMappingAction({
      accountId: "account-1",
      headers: [],
      mapping: DNB_MAPPING,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_CSV_COLUMN_MAPPING_PAYLOAD");
    expect(accountUpdateMock).not.toHaveBeenCalled();
  });

  it("rejects a mapping without a description column", async () => {
    const result = await saveAccountCsvColumnMappingAction({
      accountId: "account-1",
      headers: DNB_HEADERS,
      mapping: { ...DNB_MAPPING, description: [] },
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "INVALID_CSV_COLUMN_MAPPING",
        message:
          "Choose a date column, an amount and at least one description column from this file.",
      },
    });
    expect(accountUpdateMock).not.toHaveBeenCalled();
  });

  it("rejects a mapping that names a column the headers do not have", async () => {
    const result = await saveAccountCsvColumnMappingAction({
      accountId: "account-1",
      headers: ["Dato", "Forklaring"],
      mapping: DNB_MAPPING,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_CSV_COLUMN_MAPPING");
    expect(accountUpdateMock).not.toHaveBeenCalled();
  });

  it("maps a missing account to ACCOUNT_NOT_FOUND", async () => {
    accountUpdateMock.mockRejectedValue({ code: "P2025" });

    const result = await saveAccountCsvColumnMappingAction({
      accountId: "missing",
      headers: DNB_HEADERS,
      mapping: DNB_MAPPING,
    });

    expect(result).toEqual({
      ok: false,
      error: { code: "ACCOUNT_NOT_FOUND", message: "Account was not found." },
    });
  });

  it("falls back to CSV_COLUMN_MAPPING_SAVE_FAILED for other database errors", async () => {
    accountUpdateMock.mockRejectedValue(new Error("disk full"));

    const result = await saveAccountCsvColumnMappingAction({
      accountId: "account-1",
      headers: DNB_HEADERS,
      mapping: DNB_MAPPING,
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "CSV_COLUMN_MAPPING_SAVE_FAILED",
        message: "Could not save the column mapping for this account.",
      },
    });
  });
});
