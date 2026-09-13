import { defineConfig } from "prisma/config";
import { resolveDatabaseUrl } from "./src/lib/database-url";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: resolveDatabaseUrl(),
  },
  migrations: {
    seed: "node prisma/seed.mjs",
  },
});
