/// <reference types="vite/client" />
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import appCss from "@/app/globals.css?url";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { SIDEBAR_BOOT_SCRIPT } from "@/lib/sidebar-state";
import { PALETTE_BOOT_SCRIPT } from "@/lib/theme-palettes";
import { AppSidebar } from "./-shell/app-sidebar";
import fontsCss from "./-shell/fonts.css?url";

export const Route = createRootRoute({
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
      { rel: "stylesheet", href: fontsCss },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  component: Outlet,
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="nb" suppressHydrationWarning>
      <head>
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: static script built from the palette registry, no user input
          dangerouslySetInnerHTML={{ __html: PALETTE_BOOT_SCRIPT }}
        />
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: static script built from the sidebar state constants, no user input
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
            </div>
          </div>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  );
}
