const DEFAULT_DATABASE_URL = "file:./prisma/dev.db";

export function resolveDatabaseUrl(): string {
  return process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
}
