import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { resolveDatabaseUrl } from "./database-url";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveDatabaseUrl", () => {
  it("returns DATABASE_URL when it is set", () => {
    vi.stubEnv("DATABASE_URL", "file:./prisma/other.db");

    expect(resolveDatabaseUrl()).toBe("file:./prisma/other.db");
  });

  it("falls back to the local development database when DATABASE_URL is unset", () => {
    vi.stubEnv("DATABASE_URL", undefined);

    expect(resolveDatabaseUrl()).toBe("file:./prisma/dev.db");
  });
});
