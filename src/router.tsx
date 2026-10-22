import {
  createRouter,
  parseSearchWith,
  stringifySearchWith,
} from "@tanstack/react-router";
import {
  DefaultRouteError,
  DefaultRoutePending,
} from "./routes/-shell/route-states";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    // Plain query strings like Next's `searchParams`: no JSON-quoting, so `?belop=120` stays as typed.
    parseSearch: parseSearchWith((value) => value),
    stringifySearch: stringifySearchWith(JSON.stringify),
    // Pages read live SQLite data, so a revisit waits for fresh loader data instead of showing the cached copy first.
    defaultStaleReloadMode: "blocking",
    defaultPendingComponent: DefaultRoutePending,
    defaultErrorComponent: DefaultRouteError,
  });
}
