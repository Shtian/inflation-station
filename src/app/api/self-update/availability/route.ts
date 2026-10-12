import { NextResponse } from "next/server";
import { getUpdateAvailability } from "@/lib/self-update/availability";

export const dynamic = "force-dynamic";

export async function GET() {
  const root = process.env.SELF_UPDATE_ROOT;
  if (!root) {
    return NextResponse.json(
      { error: "SELF_UPDATE_DISABLED" },
      { status: 404 },
    );
  }

  return NextResponse.json(
    await getUpdateAvailability(
      root,
      process.env.NEXT_PUBLIC_BUILD_SHA ?? "unknown",
    ),
  );
}
