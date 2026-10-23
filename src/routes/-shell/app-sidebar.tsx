import { Link, type LinkProps, useLocation } from "@tanstack/react-router";
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
import { SidebarToggle } from "@/components/sidebar-toggle";
import { ThemeSwitcher } from "@/components/theme-switcher";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { BuildInfo } from "./build-info";

type NavItem = {
  href: NonNullable<LinkProps["to"]>;
  label: string;
  Icon: LucideIcon;
};

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
  const pathname = useLocation({ select: (location) => location.pathname });

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            to={href}
            aria-current={isActive(pathname, href) ? "page" : undefined}
            className="flex h-8 items-center gap-3 rounded-lg px-2 text-sm font-medium text-muted-foreground transition-colors outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:bg-sidebar-accent aria-[current=page]:text-sidebar-accent-foreground"
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

/** Start copy of `@/components/app-sidebar`. */
export function AppSidebar() {
  return (
    <aside className="sticky top-0 flex h-svh w-14 shrink-0 flex-col gap-4 overflow-hidden border-r border-sidebar-border bg-sidebar px-3 py-3 text-sidebar-foreground transition-[width] motion-reduce:transition-none md:in-data-[sidebar=expanded]:w-56">
      <div className="flex items-center gap-2">
        <SidebarToggle />
        <Link
          to="/"
          className="hidden text-sm font-semibold tracking-tight whitespace-nowrap text-brand md:in-data-[sidebar=expanded]:inline"
        >
          Inflation Station
        </Link>
      </div>
      <TooltipProvider>
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
        <div className="mt-auto flex flex-col gap-1">
          <NavLink href="/settings" label="Innstillinger" Icon={Settings} />
          <div className="flex flex-col gap-1 md:in-data-[sidebar=expanded]:flex-row">
            <ThemeSwitcher />
            <BuildInfo />
          </div>
        </div>
      </TooltipProvider>
    </aside>
  );
}
