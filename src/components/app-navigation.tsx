"use client";

import Link from "next/link";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";

const primaryLinks = [
  { href: "/transactions", label: "Transaksjoner" },
  { href: "/import", label: "Import" },
  { href: "/monthly-review", label: "Månedsoppsummering" },
  { href: "/assistant", label: "Innsikt" },
];

export function AppNavigation() {
  return (
    <nav aria-label="Hovedmeny" className="flex-1">
      <NavigationMenu>
        <NavigationMenuList className="justify-start gap-1">
          {primaryLinks.map((link) => (
            <NavigationMenuItem key={link.href}>
              <NavigationMenuLink
                className={navigationMenuTriggerStyle()}
                render={<Link href={link.href}>{link.label}</Link>}
              />
            </NavigationMenuItem>
          ))}
        </NavigationMenuList>
      </NavigationMenu>
    </nav>
  );
}
