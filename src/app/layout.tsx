import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { ThemeProvider } from "@/components/theme-provider";
import { ModeToggle } from "@/components/theme-toggle";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
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
  const links = [
    { href: "/overview", label: "Overview" },
    { href: "/import", label: "Import" },
    { href: "/accounts", label: "Accounts" },
    { href: "/categories", label: "Categories" },
  ];

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
          storageKey="inflation-station-theme"
        >
          <div className="min-h-screen">
            <header className="border-b border-border bg-background/95 backdrop-blur">
              <div className="mx-auto flex w-full max-w-6xl items-center gap-6 px-5 py-3 md:px-10">
                <Link href="/" className="text-sm font-semibold tracking-tight">
                  Inflation Station
                </Link>
                <nav aria-label="Primary" className="flex flex-wrap gap-2">
                  {links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    >
                      {link.label}
                    </Link>
                  ))}
                </nav>
                <ModeToggle />
              </div>
            </header>
            {children}
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
