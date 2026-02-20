import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

type RouteParams = {
  params: Promise<{
    categoryId: string;
  }>;
};

const updateCategorySchema = z.object({
  name: z.string().trim().min(1),
});

export async function PATCH(request: Request, { params }: RouteParams) {
  const { categoryId } = await params;
  const payload = await request.json().catch(() => null);
  const parsed = updateCategorySchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_CATEGORY_PAYLOAD", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const category = await prisma.category.update({
      where: { id: categoryId },
      data: {
        name: parsed.data.name,
      },
    });

    return NextResponse.json({ category });
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

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "CATEGORY_NAME_MUST_BE_UNIQUE" },
        { status: 409 },
      );
    }

    throw error;
  }
}

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
