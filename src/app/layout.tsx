import type { Metadata } from "next";
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import Link from "next/link";
import { AppNavigation } from "@/components/app-navigation";
import { BuildInfoFooter } from "@/components/build-info-footer";
import { FeedbackWidget } from "@/components/feedback/feedback-widget";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Toaster } from "@/components/ui/sonner";
import { resolveFeedbackDisabledReason } from "@/lib/feedback/agent";
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
    "Personal economy dashboard for account imports and transaction review.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: static script built from the palette registry, no user input
          dangerouslySetInnerHTML={{ __html: PALETTE_BOOT_SCRIPT }}
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
          <div className="flex min-h-screen flex-col">
            <header className="relative z-nav-header border-border border-b bg-background/95 backdrop-blur">
              <div className="mx-auto flex w-full max-w-6xl items-center gap-6 px-5 py-3 md:px-10">
                <Link
                  href="/"
                  className="font-semibold text-brand text-sm tracking-tight"
                >
                  Inflation Station
                </Link>
                <AppNavigation />
                <ThemeSwitcher />
              </div>
            </header>
            {children}
            <Toaster richColors />
            {resolveFeedbackDisabledReason() === null ? (
              <FeedbackWidget />
            ) : null}
            <BuildInfoFooter />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
