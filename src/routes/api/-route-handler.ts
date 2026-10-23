import type { RouteMethod } from "@tanstack/react-start";

type ServerRoute = {
  options: { server?: { handlers?: unknown } };
};

type Handler = (ctx: {
  request: Request;
  params: Record<string, string>;
}) => Response | Promise<Response>;

/** Calls a server route's handler the way Start does, for unit tests. */
export function routeHandler(route: ServerRoute, method: RouteMethod) {
  const handlers = route.options.server?.handlers as
    | Partial<Record<RouteMethod, Handler>>
    | undefined;
  const handler = handlers?.[method];
  if (!handler) {
    throw new Error(`The route has no ${method} handler.`);
  }

  return async (
    request = new Request("http://localhost"),
    params: Record<string, string> = {},
  ) => handler({ request, params });
}
