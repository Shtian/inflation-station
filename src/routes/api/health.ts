import { createFileRoute } from "@tanstack/react-router";
import { prisma } from "@/lib/prisma";

const noStore = { "Cache-Control": "no-store" };

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        try {
          await prisma.$queryRaw`SELECT 1`;
          return Response.json({ status: "ok" }, { headers: noStore });
        } catch {
          // The route is unauthenticated, so the error could leak connection details.
          return Response.json(
            { status: "error" },
            { status: 503, headers: noStore },
          );
        }
      },
      ANY: async () => new Response(null, { status: 405 }),
    },
  },
});
