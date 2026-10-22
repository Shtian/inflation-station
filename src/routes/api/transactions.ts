import { createFileRoute } from "@tanstack/react-router";
import { parseIsoDate } from "@/lib/iso-date";
import { prisma } from "@/lib/prisma";
import { deleteTransactions } from "@/lib/transactions/delete";
import { getTransactionsPage } from "@/lib/transactions/list";
import {
  createTransaction,
  parseTransactionCreatePayload,
} from "@/lib/transactions/write";
import { formatPayloadErrorMessage } from "./transactions/-payload-error-message";

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
  return value === null ? null : parseIsoDate(value);
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

export const Route = createFileRoute("/api/transactions")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const pageParam = url.searchParams.get("page");
        const pageSizeParam = url.searchParams.get("pageSize");
        const sortingParam = url.searchParams.get("sorting");
        const query =
          parseOptionalFilterParam(url.searchParams.get("globalQuery")) ??
          parseOptionalFilterParam(url.searchParams.get("query"));
        const dateFromParam = url.searchParams.get("dateFrom");
        const dateToParam = url.searchParams.get("dateTo");
        const accountId = parseOptionalFilterParam(
          url.searchParams.get("accountId"),
        );
        const categoryId = parseOptionalFilterParam(
          url.searchParams.get("categoryId"),
        );

        const parsedPage =
          pageParam === null ? DEFAULT_PAGE : parsePositiveInteger(pageParam);
        if (parsedPage === null) {
          return Response.json(
            {
              error: "INVALID_PAGE",
              message: "page må være et positivt heltall.",
            },
            { status: 400 },
          );
        }

        const parsedPageSize =
          pageSizeParam === null
            ? DEFAULT_PAGE_SIZE
            : parsePositiveInteger(pageSizeParam);
        if (parsedPageSize === null) {
          return Response.json(
            {
              error: "INVALID_PAGE_SIZE",
              message: "pageSize må være et positivt heltall.",
            },
            { status: 400 },
          );
        }

        if (parsedPageSize > MAX_PAGE_SIZE) {
          return Response.json(
            {
              error: "INVALID_PAGE_SIZE",
              message: `pageSize kan ikke være større enn ${MAX_PAGE_SIZE}.`,
            },
            { status: 400 },
          );
        }

        const parsedSorting = parseSortingParam(sortingParam);
        if (sortingParam !== null && parsedSorting === null) {
          return Response.json(
            {
              error: "INVALID_SORTING",
              message:
                "sorting må ha formatet <felt>:<retning> med feltene bookingDate, amountNok, merchant eller category.",
            },
            { status: 400 },
          );
        }

        const dateFrom = parseDateParam(dateFromParam);
        if (dateFromParam !== null && dateFrom === null) {
          return Response.json(
            {
              error: "INVALID_DATE_FROM",
              message: "dateFrom må ha formatet ÅÅÅÅ-MM-DD.",
            },
            { status: 400 },
          );
        }

        const dateTo = parseDateParam(dateToParam);
        if (dateToParam !== null && dateTo === null) {
          return Response.json(
            {
              error: "INVALID_DATE_TO",
              message: "dateTo må ha formatet ÅÅÅÅ-MM-DD.",
            },
            { status: 400 },
          );
        }

        if (dateFrom && dateTo && dateFrom > dateTo) {
          return Response.json(
            {
              error: "INVALID_DATE_RANGE",
              message: "dateFrom kan ikke være senere enn dateTo.",
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

        return Response.json(response);
      },
      DELETE: async ({ request }) => {
        const body = await request.json().catch(() => null);

        if (
          !body ||
          typeof body !== "object" ||
          !("ids" in body) ||
          !Array.isArray(body.ids) ||
          body.ids.length === 0 ||
          !body.ids.every((id: unknown) => typeof id === "string")
        ) {
          return Response.json(
            {
              error: "INVALID_IDS",
              message: "ids må være en ikke-tom liste med strenger.",
            },
            { status: 400 },
          );
        }

        const deleted = await deleteTransactions(prisma, body.ids as string[]);

        return Response.json({ deleted });
      },
      POST: async ({ request }) => {
        const body = await request.json().catch(() => null);

        const parsed = parseTransactionCreatePayload(body);

        if (!parsed.success) {
          const flattened = parsed.error.flatten();

          return Response.json(
            {
              error: "INVALID_PAYLOAD",
              message: formatPayloadErrorMessage(
                "Ugyldige transaksjonsdata.",
                flattened,
              ),
              details: flattened.fieldErrors,
            },
            { status: 400 },
          );
        }

        try {
          const transaction = await createTransaction(prisma, parsed.data);

          return Response.json({ id: transaction.id }, { status: 201 });
        } catch (error) {
          if (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            error.code === "P2003"
          ) {
            return Response.json(
              {
                error: "CATEGORY_OR_ACCOUNT_NOT_FOUND",
                message: "Fant ikke den valgte kontoen eller kategorien.",
              },
              { status: 404 },
            );
          }

          throw error;
        }
      },
    },
  },
});
