"use client";

import {
  ArrowLeftRight,
  CalendarDays,
  Landmark,
  LayoutDashboard,
  type LucideIcon,
  Plane,
  Repeat,
  Settings,
  Sparkles,
  Tags,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type NavItem = { href: string; label: string; Icon: LucideIcon };

const navGroups: NavItem[][] = [
  [
    { href: "/", label: "Oversikt", Icon: LayoutDashboard },
    { href: "/transactions", label: "Transaksjoner", Icon: ArrowLeftRight },
    { href: "/import", label: "Import", Icon: Upload },
    {
      href: "/monthly-review",
      label: "Månedsoppsummering",
      Icon: CalendarDays,
    },
    { href: "/assistant", label: "Innsikt", Icon: Sparkles },
    { href: "/subscriptions", label: "Faste trekk", Icon: Repeat },
    { href: "/trips", label: "Turer", Icon: Plane },
  ],
  [
    { href: "/accounts", label: "Kontoer", Icon: Landmark },
    { href: "/categories", label: "Kategorier", Icon: Tags },
  ],
];

function isActive(pathname: string, href: string) {
  return href === "/"
    ? pathname === "/"
    : pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ href, label, Icon }: NavItem) {
  const pathname = usePathname();

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            href={href}
            aria-current={isActive(pathname, href) ? "page" : undefined}
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
  );
}

export function SettingsNavLink() {
  return <NavLink href="/settings" label="Innstillinger" Icon={Settings} />;
}

export function AppNavigation() {
  return (
    <nav aria-label="Hovedmeny" className="flex flex-col gap-3">
      {navGroups.map((group) => (
        <ul
          key={group[0].href}
          className="flex flex-col gap-1 border-sidebar-border not-first:border-t not-first:pt-3"
        >
          {group.map((item) => (
            <li key={item.href}>
              <NavLink {...item} />
            </li>
          ))}
        </ul>
      ))}
    </nav>
  );
}
