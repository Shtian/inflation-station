import { NextResponse } from "next/server";
import { getCategoryMerchantHistory } from "@/lib/categorization/category-merchants";
import { prisma } from "@/lib/prisma";

type RouteParams = {
  params: Promise<{
    categoryId: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteParams) {
  const { categoryId } = await params;
  const history = await getCategoryMerchantHistory(prisma, categoryId);

  if (history === null) {
    return NextResponse.json({ error: "CATEGORY_NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ history });
}
