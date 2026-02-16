import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteParams = {
  params: Promise<{
    categoryId: string;
  }>;
};

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { categoryId } = await params;

  try {
    await prisma.category.delete({
      where: { id: categoryId },
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
        { error: "CATEGORY_NOT_FOUND" },
        { status: 404 },
      );
    }

    throw error;
  }
}
