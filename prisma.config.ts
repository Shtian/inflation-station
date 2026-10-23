import { defineConfig } from "prisma/config";
import { resolveDatabaseUrl } from "./prisma/database-url";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: resolveDatabaseUrl(),
  },
  migrations: {
    seed: "node prisma/seed.mjs",
  },
});
