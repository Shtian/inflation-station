import { describe, expect, it } from "vitest";
import {
  siblingImports,
  startRoutePath,
  transformRoute,
} from "./port-api-routes";

describe("startRoutePath", () => {
  it("maps a static route", () => {
    expect(startRoutePath("src/app/api/accounts/route.ts")).toEqual({
      file: "src/routes/api/accounts.ts",
      routeId: "/api/accounts",
    });
  });

  it("maps nested dynamic segments", () => {
    expect(
      startRoutePath("src/app/api/categories/[categoryId]/merchants/route.ts"),
    ).toEqual({
      file: "src/routes/api/categories/$categoryId/merchants.ts",
      routeId: "/api/categories/$categoryId/merchants",
    });
  });
});

describe("transformRoute", () => {
  it("passes params to a handler that ignores the request", () => {
    const source = `import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteParams = {
  params: Promise<{ ruleId: string }>;
};

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { ruleId } = await params;
  await prisma.categoryRule.delete({ where: { id: ruleId } });
  return NextResponse.json({ ok: true });
}
`;

    expect(
      transformRoute(source, "/api/category-rules/$ruleId"),
    ).toBe(`import { createFileRoute } from "@tanstack/react-router";
import { prisma } from "@/lib/prisma";

export const Route = createFileRoute("/api/category-rules/$ruleId")({
server: {
handlers: {
DELETE: async ({ params }) => {
  const { ruleId } = params;
  await prisma.categoryRule.delete({ where: { id: ruleId } });
  return Response.json({ ok: true });
},
},
},
});
`);
  });

  it("keeps the request and orders methods as in the source", () => {
    const source = `import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ items: [] });
}

export async function POST(request: Request) {
  const payload = await request.json();
  return NextResponse.json(payload, { status: 201 });
}
`;

    expect(
      transformRoute(source, "/api/accounts"),
    ).toBe(`import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/accounts")({
server: {
handlers: {
GET: async () => {
  return Response.json({ items: [] });
},
POST: async ({ request }) => {
  const payload = await request.json();
  return Response.json(payload, { status: 201 });
},
},
},
});
`);
  });

  it("drops force-dynamic together with its comment", () => {
    const source = `import { NextResponse } from "next/server";
import { readStatus } from "@/lib/status";

// Read per request.
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await readStatus());
}
`;

    expect(
      transformRoute(source, "/api/self-update/status"),
    ).toBe(`import { createFileRoute } from "@tanstack/react-router";
import { readStatus } from "@/lib/status";

export const Route = createFileRoute("/api/self-update/status")({
server: {
handlers: {
GET: async () => {
  return Response.json(await readStatus());
},
},
},
});
`);
  });

  it("points relative imports at the dash-prefixed copy", () => {
    const source = `import { NextResponse } from "next/server";
import { formatPayloadErrorMessage } from "../payload-error-message";

export async function DELETE(request: Request) {
  return NextResponse.json({ message: formatPayloadErrorMessage("x", request) });
}
`;

    expect(
      transformRoute(source, "/api/transactions/$transactionId"),
    ).toBe(`import { createFileRoute } from "@tanstack/react-router";
import { formatPayloadErrorMessage } from "./-payload-error-message";

export const Route = createFileRoute("/api/transactions/$transactionId")({
server: {
handlers: {
DELETE: async ({ request }) => {
  return Response.json({ message: formatPayloadErrorMessage("x", request) });
},
},
},
});
`);
    expect(siblingImports(source, "/api/transactions/$transactionId")).toEqual([
      {
        specifier: "../payload-error-message",
        rewrittenSpecifier: "./-payload-error-message",
        nextPath: "src/app/api/transactions/payload-error-message.ts",
        startPath: "src/routes/api/transactions/-payload-error-message.ts",
      },
    ]);
  });

  it("throws on NextResponse usage it cannot port", () => {
    const source = `import { NextResponse } from "next/server";

export async function GET(request: Request) {
  return NextResponse.redirect(new URL("/", request.url));
}
`;

    expect(() => transformRoute(source, "/api/accounts")).toThrow(
      "Cannot port /api/accounts: unsupported NextResponse usage at line 4",
    );
  });
});
