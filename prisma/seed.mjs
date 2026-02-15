import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import prismaClient from "@prisma/client";

const { PrismaClient } = prismaClient;

const adapter = new PrismaBetterSqlite3({ url: "file:./prisma/dev.db" });
const prisma = new PrismaClient({ adapter });

const defaultAccounts = [
  { name: "Checking Account", institution: "Default Bank" },
  { name: "Savings Account", institution: "Default Bank" },
  { name: "Credit Card", institution: "Default Bank" },
  { name: "Cash Wallet", institution: "Local Cash" },
];

async function main() {
  for (const account of defaultAccounts) {
    await prisma.account.upsert({
      where: { name: account.name },
      update: {
        institution: account.institution,
        isActive: true,
      },
      create: {
        name: account.name,
        institution: account.institution,
      },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
