import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const categories = await prisma.category.findMany({
    select: {
      id: true,
      name: true,
      kind: true,
      accountId: true,
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });

  return NextResponse.json({ categories });
}
