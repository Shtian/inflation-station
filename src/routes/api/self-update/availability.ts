import { createFileRoute } from "@tanstack/react-router";
import { getUpdateAvailability } from "@/lib/self-update/availability";

export const Route = createFileRoute("/api/self-update/availability")({
  server: {
    handlers: {
      GET: async () => {
        const root = process.env.SELF_UPDATE_ROOT;
        if (!root) {
          return Response.json(
            { error: "SELF_UPDATE_DISABLED" },
            { status: 404 },
          );
        }

        return Response.json(
          await getUpdateAvailability(
            root,
            import.meta.env.VITE_BUILD_SHA ?? "unknown",
          ),
        );
      },
      ANY: async () => new Response(null, { status: 405 }),
    },
  },
});
