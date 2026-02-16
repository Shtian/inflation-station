import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteParams = {
  params: Promise<{
    ruleId: string;
  }>;
};

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { ruleId } = await params;

  try {
    await prisma.categoryRule.delete({
      where: { id: ruleId },
    });

    return new Response(null, { status: 204 });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { error: "CATEGORY_RULE_NOT_FOUND" },
        { status: 404 },
      );
    }

    throw error;
  }
}
