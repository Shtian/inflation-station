import { describe, expect, it } from "vitest";
import {
  parseTransactionsTableUrlState,
  toTransactionsTableSearchParams,
  withFilterStateChange,
} from "./transactions-table-url-state";

describe("parseTransactionsTableUrlState", () => {
  it("parses valid URL state for transactions table", () => {
    const state = parseTransactionsTableUrlState(
      new URLSearchParams(
        "page=3&pageSize=50&sorting=amountNok:asc&globalQuery=coffee&dateFrom=2026-01-01&dateTo=2026-01-31&accountId=acc-1&categoryId=cat-2",
      ),
    );

    expect(state).toEqual({
      page: 3,
      pageSize: 50,
      sorting: {
        field: "amountNok",
        direction: "asc",
      },
      globalQuery: "coffee",
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
      accountId: "acc-1",
      categoryId: "cat-2",
    });
  });

  it("falls back to defaults when URL params are malformed", () => {
    const state = parseTransactionsTableUrlState(
      new URLSearchParams(
        "page=0&pageSize=13&sorting=merchant:up&globalQuery=%20%20&dateFrom=oops&dateTo=2026-2-1&accountId=%20%20&categoryId=%20%20",
      ),
    );

    expect(state).toEqual({
      page: 1,
      pageSize: 25,
      sorting: undefined,
      globalQuery: undefined,
      dateFrom: undefined,
      dateTo: undefined,
      accountId: undefined,
      categoryId: undefined,
    });
  });

  it("uses legacy query when globalQuery is missing", () => {
    const state = parseTransactionsTableUrlState(
      new URLSearchParams("query= bakery "),
    );

    expect(state.globalQuery).toBe("bakery");
  });
});

describe("toTransactionsTableSearchParams", () => {
  it("serializes state and preserves unrelated search params", () => {
    const searchParams = toTransactionsTableSearchParams(
      {
        page: 2,
        pageSize: 10,
        sorting: {
          field: "bookingDate",
          direction: "desc",
        },
        globalQuery: "rent",
        dateFrom: "2026-02-01",
        accountId: "acc-4",
      },
      new URLSearchParams("foo=bar&page=99&query=old"),
    );

    expect(searchParams.toString()).toBe(
      "foo=bar&page=2&pageSize=10&sorting=bookingDate%3Adesc&globalQuery=rent&dateFrom=2026-02-01&accountId=acc-4",
    );
  });
});

describe("withFilterStateChange", () => {
  it("resets page to first page when filters change", () => {
    const nextState = withFilterStateChange(
      {
        page: 4,
        pageSize: 25,
        accountId: "acc-1",
      },
      {
        accountId: "acc-2",
      },
    );

    expect(nextState).toEqual({
      page: 1,
      pageSize: 25,
      accountId: "acc-2",
    });
  });
});
