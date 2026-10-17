"use client";

import {
  ArrowLeftRight,
  CalendarDays,
  type LucideIcon,
  Sparkles,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const primaryLinks: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "/transactions", label: "Transaksjoner", Icon: ArrowLeftRight },
  { href: "/import", label: "Import", Icon: Upload },
  { href: "/monthly-review", label: "Månedsoppsummering", Icon: CalendarDays },
  { href: "/assistant", label: "Innsikt", Icon: Sparkles },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Hovedmeny">
      <TooltipProvider>
        <ul className="flex flex-col gap-1">
          {primaryLinks.map(({ href, label, Icon }) => (
            <li key={href}>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Link
                      href={href}
                      aria-current={
                        isActive(pathname, href) ? "page" : undefined
                      }
                      className="flex h-8 items-center gap-3 rounded-lg px-2 font-medium text-muted-foreground text-sm outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:bg-sidebar-accent aria-[current=page]:text-sidebar-accent-foreground"
                    />
                  }
                >
                  <Icon
                    aria-hidden
                    className="size-4 shrink-0 in-aria-[current=page]:text-brand"
                  />
                  <span className="sr-only md:in-data-[sidebar=expanded]:not-sr-only">
                    {label}
                  </span>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  className="md:in-data-[sidebar=expanded]:hidden"
                >
                  {label}
                </TooltipContent>
              </Tooltip>
            </li>
          ))}
        </ul>
      </TooltipProvider>
    </nav>
  );
}
