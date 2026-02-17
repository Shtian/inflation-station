import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTransactionsPage } from "@/lib/transactions/list";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

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
  const accountId = url.searchParams.get("accountId")?.trim() ?? "";

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

  const response = await getTransactionsPage(prisma, {
    page: parsedPage,
    pageSize: parsedPageSize,
    accountId: accountId || undefined,
  });

  return NextResponse.json(response);
}
