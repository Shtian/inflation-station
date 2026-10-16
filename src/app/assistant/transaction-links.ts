import { getToolName, isToolUIPart } from "ai";
import { toMonthDateRange } from "@/app/monthly-review/[monthStart]/month-in-review.format";
import {
  DEFAULT_PAGE_SIZE,
  type TransactionsTableUrlState,
  toTransactionsTableSearchParams,
} from "@/app/transactions/transactions-table-url-state";
import type {
  AssistantUIMessage,
  AssistantUITools,
} from "@/lib/assistant/contract";
import { parseIsoDate } from "@/lib/iso-date";

export type TransactionLink = { href: string; label: string };

type TransactionLinkFilter = Pick<
  TransactionsTableUrlState,
  "dateFrom" | "dateTo" | "categoryId" | "accountId" | "globalQuery"
>;

type ToolName = keyof AssistantUITools & string;

type LinkFilterTable = {
  [K in ToolName]?: (
    input: AssistantUITools[K]["input"],
  ) => TransactionLinkFilter | null;
};

const MAX_LINKS = 3;

const LINK_FILTERS: LinkFilterTable = {
  searchTransactions: (input) => ({
    dateFrom: input.from,
    dateTo: input.to,
    categoryId: input.categoryId,
    accountId: input.accountId,
    globalQuery: input.query,
  }),
  summarizeSpending: (input) => {
    const categoryIds = input.categoryIds ?? [];
    const accountIds = input.accountIds ?? [];
    if (categoryIds.length > 1 || accountIds.length > 1) {
      return null;
    }
    return {
      dateFrom: input.from,
      dateTo: input.to,
      categoryId: categoryIds[0],
      accountId: accountIds[0],
      globalQuery: input.merchantQuery,
    };
  },
  getMonthInReview: (input) => {
    const monthStart = `${input.month}-01`;
    return parseIsoDate(monthStart) ? toMonthDateRange(monthStart) : null;
  },
};

function hasLinkFilter(name: string): name is ToolName {
  return Object.hasOwn(LINK_FILTERS, name);
}

function filterFor<K extends ToolName>(
  name: K,
  input: AssistantUITools[K]["input"],
): TransactionLinkFilter | null {
  const derive: LinkFilterTable[K] = LINK_FILTERS[name];
  return derive ? derive(input) : null;
}

const dateFormatter = new Intl.DateTimeFormat("nb-NO", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function formatDateRange(
  dateFrom: string | undefined,
  dateTo: string | undefined,
): string | null {
  const from = dateFrom ? parseIsoDate(dateFrom) : null;
  const to = dateTo ? parseIsoDate(dateTo) : null;
  if (from && to) {
    return dateFormatter.formatRange(from, to);
  }
  if (from) {
    return `fra ${dateFormatter.format(from)}`;
  }
  if (to) {
    return `til ${dateFormatter.format(to)}`;
  }
  return null;
}

function collectNames(message: AssistantUIMessage) {
  const categories = new Map<string, string>();
  const accounts = new Map<string, string>();
  for (const part of message.parts) {
    if (
      part.type === "tool-listCategories" &&
      part.state === "output-available"
    ) {
      for (const category of part.output) {
        categories.set(category.id, category.name);
      }
    }
    if (
      part.type === "tool-listAccounts" &&
      part.state === "output-available"
    ) {
      for (const account of part.output) {
        accounts.set(account.id, account.name);
      }
    }
  }
  return { categories, accounts };
}

export function deriveTransactionLinks(
  message: AssistantUIMessage,
): TransactionLink[] {
  const names = collectNames(message);
  const links = new Map<string, string>();

  for (const part of message.parts) {
    if (links.size >= MAX_LINKS) {
      break;
    }
    if (
      !isToolUIPart(part) ||
      part.type === "dynamic-tool" ||
      part.state !== "output-available"
    ) {
      continue;
    }
    const name = getToolName(part);
    if (!hasLinkFilter(name)) {
      continue;
    }
    const filter = filterFor(name, part.input);
    if (!filter) {
      continue;
    }

    const href = `/transactions?${toTransactionsTableSearchParams({
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      ...filter,
    })}`;
    if (links.has(href)) {
      continue;
    }

    const subject =
      (filter.categoryId && names.categories.get(filter.categoryId)) ||
      (filter.accountId && names.accounts.get(filter.accountId)) ||
      null;
    const range = formatDateRange(filter.dateFrom, filter.dateTo);
    const label = ["Se transaksjonene", subject, range]
      .filter((segment) => segment)
      .join(" · ");
    links.set(href, label);
  }

  return Array.from(links, ([href, label]) => ({ href, label }));
}
