import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactNode } from "react";
import faviconUrl from "@/app/favicon.ico?url";
import appCss from "@/app/globals.css?url";
import { FeedbackWidget } from "@/components/feedback/feedback-widget";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { resolveFeedbackDisabledReason } from "@/lib/feedback/agent";
import { SIDEBAR_BOOT_SCRIPT } from "@/lib/sidebar-state";
import { PALETTE_BOOT_SCRIPT } from "@/lib/theme-palettes";
import { AppSidebar } from "./-shell/app-sidebar";
import fontsCss from "./-shell/fonts.css?url";

const getShellFlags = createServerFn({ method: "GET" }).handler(() => ({
  feedbackEnabled: resolveFeedbackDisabledReason() === null,
  selfUpdateEnabled: Boolean(process.env.SELF_UPDATE_ROOT),
}));

export const Route = createRootRoute({
  loader: () => getShellFlags(),
  // Server env only changes on restart, so client navigations reuse the first answer.
  staleTime: Number.POSITIVE_INFINITY,
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Inflation Station" },
      {
        name: "description",
        content:
          "Personlig økonomioversikt for kontoimport og gjennomgang av transaksjoner.",
      },
    ],
    links: [
      { rel: "icon", href: faviconUrl },
      { rel: "stylesheet", href: fontsCss },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  component: Outlet,
  shellComponent: RootDocument,
  notFoundComponent: NotFound,
});

function NotFound() {
  return (
    <main className="mx-auto w-full max-w-6xl space-y-2 px-5 py-8 md:px-10">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Fant ikke siden
      </h1>
      <p className="text-sm text-muted-foreground">
        Siden finnes ikke, eller den er ikke flyttet til denne serveren ennå.
      </p>
    </main>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  const { feedbackEnabled } = Route.useLoaderData();

  return (
    <html lang="nb" suppressHydrationWarning>
      <head>
        <script
          // Static script built from the palette registry, no user input.
          dangerouslySetInnerHTML={{ __html: PALETTE_BOOT_SCRIPT }}
        />
        <script
          // Static script built from the sidebar state constants, no user input.
          dangerouslySetInnerHTML={{ __html: SIDEBAR_BOOT_SCRIPT }}
        />
        <HeadContent />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
          storageKey="inflation-station-theme"
        >
          <div className="flex min-h-screen">
            <AppSidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              {children}
              <Toaster richColors />
              {feedbackEnabled ? <FeedbackWidget /> : null}
            </div>
          </div>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  );
}
