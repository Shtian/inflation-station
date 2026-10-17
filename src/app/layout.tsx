import type { Metadata } from "next";
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { AppSidebar } from "@/components/app-sidebar";
import { FeedbackWidget } from "@/components/feedback/feedback-widget";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { resolveFeedbackDisabledReason } from "@/lib/feedback/agent";
import { SIDEBAR_BOOT_SCRIPT } from "@/lib/sidebar-state";
import { PALETTE_BOOT_SCRIPT } from "@/lib/theme-palettes";
import "./globals.css";

const jakartaSans = Plus_Jakarta_Sans({
  variable: "--font-jakarta-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Inflation Station",
  description:
    "Personlig økonomioversikt for kontoimport og gjennomgang av transaksjoner.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
      </head>
      <body
        className={`${jakartaSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
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
              {resolveFeedbackDisabledReason() === null ? (
                <FeedbackWidget />
              ) : null}
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
