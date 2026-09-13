import { afterEach, describe, expect, it } from "vitest";
import { resolveDatabaseUrl } from "./database-url";

const originalDatabaseUrl = process.env.DATABASE_URL;

afterEach(() => {
  if (originalDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
    return;
  }

  process.env.DATABASE_URL = originalDatabaseUrl;
});

describe("resolveDatabaseUrl", () => {
  it("returns DATABASE_URL when it is set", () => {
    process.env.DATABASE_URL = "file:./prisma/other.db";

    expect(resolveDatabaseUrl()).toBe("file:./prisma/other.db");
  });

  it("falls back to the local development database when DATABASE_URL is unset", () => {
    delete process.env.DATABASE_URL;

    expect(resolveDatabaseUrl()).toBe("file:./prisma/dev.db");
  });
});
