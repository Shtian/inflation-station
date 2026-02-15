import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="min-h-screen">
          <header className="border-b border-zinc-200 bg-white/95 backdrop-blur">
            <div className="mx-auto flex w-full max-w-6xl items-center gap-6 px-5 py-3 md:px-10">
              <Link href="/" className="text-sm font-semibold tracking-tight">
                Inflation Station
              </Link>
              <nav aria-label="Primary" className="flex flex-wrap gap-2">
                {links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="rounded-md px-2 py-1 text-sm text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
