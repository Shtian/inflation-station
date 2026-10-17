import Link from "next/link";
import { AppNavigation, SettingsNavLink } from "@/components/app-navigation";
import { BuildInfo } from "@/components/build-info";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { TooltipProvider } from "@/components/ui/tooltip";

export function AppSidebar() {
  return (
    <aside className="sticky top-0 flex h-svh w-14 shrink-0 flex-col gap-4 overflow-hidden border-sidebar-border border-r bg-sidebar px-3 py-3 text-sidebar-foreground transition-[width] motion-reduce:transition-none md:in-data-[sidebar=expanded]:w-56">
      <div className="flex items-center gap-2">
        <SidebarToggle />
        <Link
          href="/"
          className="hidden whitespace-nowrap font-semibold text-brand text-sm tracking-tight md:in-data-[sidebar=expanded]:inline"
        >
          Inflation Station
        </Link>
      </div>
      <TooltipProvider>
        <AppNavigation />
        <div className="mt-auto flex flex-col gap-1">
          <SettingsNavLink />
          <div className="flex flex-col gap-1 md:in-data-[sidebar=expanded]:flex-row">
            <ThemeSwitcher />
            <BuildInfo />
          </div>
        </div>
      </TooltipProvider>
    </aside>
  );
}
