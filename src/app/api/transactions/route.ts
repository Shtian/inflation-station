import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteTransactions } from "@/lib/transactions/delete";
import { getTransactionsPage } from "@/lib/transactions/list";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const SORT_FIELDS = [
  "bookingDate",
  "amountNok",
  "merchant",
  "category",
] as const;

type SortField = (typeof SORT_FIELDS)[number];
type SortDirection = "asc" | "desc";

function parseDateParam(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseOptionalFilterParam(value: string | null): string | undefined {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : undefined;
}

function parseSortingParam(value: string | null): {
  field: SortField;
  direction: SortDirection;
} | null {
  if (value === null) {
    return null;
  }

  const match = /^([a-zA-Z]+):(asc|desc)$/.exec(value);
  if (!match) {
    return null;
  }

  const parsedField = match[1] as SortField;
  const direction = match[2] as SortDirection;

  if (!SORT_FIELDS.includes(parsedField)) {
    return null;
  }

  return {
    field: parsedField,
    direction,
  };
}

function parsePositiveInteger(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return parsed > 0 ? parsed : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const pageParam = url.searchParams.get("page");
  const pageSizeParam = url.searchParams.get("pageSize");
  const sortingParam = url.searchParams.get("sorting");
  const query =
    parseOptionalFilterParam(url.searchParams.get("globalQuery")) ??
    parseOptionalFilterParam(url.searchParams.get("query"));
  const dateFromParam = url.searchParams.get("dateFrom");
  const dateToParam = url.searchParams.get("dateTo");
  const accountId = parseOptionalFilterParam(url.searchParams.get("accountId"));
  const categoryId = parseOptionalFilterParam(
    url.searchParams.get("categoryId"),
  );

  const parsedPage =
    pageParam === null ? DEFAULT_PAGE : parsePositiveInteger(pageParam);
  if (parsedPage === null) {
    return NextResponse.json(
      {
        error: "INVALID_PAGE",
        message: "Expected page to be a positive integer.",
      },
      { status: 400 },
    );
  }

  const parsedPageSize =
    pageSizeParam === null
      ? DEFAULT_PAGE_SIZE
      : parsePositiveInteger(pageSizeParam);
  if (parsedPageSize === null) {
    return NextResponse.json(
      {
        error: "INVALID_PAGE_SIZE",
        message: "Expected pageSize to be a positive integer.",
      },
      { status: 400 },
    );
  }

  if (parsedPageSize > MAX_PAGE_SIZE) {
    return NextResponse.json(
      {
        error: "INVALID_PAGE_SIZE",
        message: `Expected pageSize to be less than or equal to ${MAX_PAGE_SIZE}.`,
      },
      { status: 400 },
    );
  }

  const parsedSorting = parseSortingParam(sortingParam);
  if (sortingParam !== null && parsedSorting === null) {
    return NextResponse.json(
      {
        error: "INVALID_SORTING",
        message:
          "Expected sorting in <field>:<direction> format using bookingDate, amountNok, merchant, or category fields.",
      },
      { status: 400 },
    );
  }

  const dateFrom = parseDateParam(dateFromParam);
  if (dateFromParam !== null && dateFrom === null) {
    return NextResponse.json(
      {
        error: "INVALID_DATE_FROM",
        message: "Expected dateFrom in YYYY-MM-DD format.",
      },
      { status: 400 },
    );
  }

  const dateTo = parseDateParam(dateToParam);
  if (dateToParam !== null && dateTo === null) {
    return NextResponse.json(
      {
        error: "INVALID_DATE_TO",
        message: "Expected dateTo in YYYY-MM-DD format.",
      },
      { status: 400 },
    );
  }

  if (dateFrom && dateTo && dateFrom > dateTo) {
    return NextResponse.json(
      {
        error: "INVALID_DATE_RANGE",
        message: "dateFrom must be less than or equal to dateTo.",
      },
      { status: 400 },
    );
  }

  const response = await getTransactionsPage(prisma, {
    page: parsedPage,
    pageSize: parsedPageSize,
    sorting: parsedSorting ?? undefined,
    query,
    dateFrom: dateFrom ?? undefined,
    dateTo: dateTo ?? undefined,
    accountId,
    categoryId,
  });

  return NextResponse.json(response);
}

export async function DELETE(request: Request) {
  const body = await request.json().catch(() => null);

  if (
    !body ||
    typeof body !== "object" ||
    !("ids" in body) ||
    !Array.isArray(body.ids) ||
    body.ids.length === 0 ||
    !body.ids.every((id: unknown) => typeof id === "string")
  ) {
    return NextResponse.json(
      {
        error: "INVALID_IDS",
        message: "Expected ids to be a non-empty array of strings.",
      },
      { status: 400 },
    );
  }

  const deleted = await deleteTransactions(prisma, body.ids as string[]);

  return NextResponse.json({ deleted });
}
