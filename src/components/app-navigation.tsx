"use client";

import Link from "next/link";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";

const primaryLinks = [
  { href: "/transactions", label: "Transactions" },
  { href: "/import", label: "Import" },
  { href: "/monthly-review", label: "Monthly Review" },
];

const configurationLinks = [
  {
    href: "/monthly-review/settings",
    label: "Monthly Review Settings",
    description: "Edit AI system prompt defaults for monthly reviews.",
  },
  {
    href: "/import-provider-mappings",
    label: "Providers",
    description: "Manage CSV provider mappings and field transforms.",
  },
  {
    href: "/accounts",
    label: "Accounts",
    description: "Create and maintain the accounts used for imports.",
  },
  {
    href: "/categories",
    label: "Categories",
    description: "Define spending categories and category rules.",
  },
];

export function AppNavigation() {
  return (
    <nav aria-label="Primary" className="flex-1">
      <NavigationMenu viewport={false}>
        <NavigationMenuList className="justify-start gap-1">
          {primaryLinks.map((link) => (
            <NavigationMenuItem key={link.href}>
              <NavigationMenuLink
                asChild
                className={navigationMenuTriggerStyle()}
              >
                <Link href={link.href}>{link.label}</Link>
              </NavigationMenuLink>
            </NavigationMenuItem>
          ))}
          <NavigationMenuItem>
            <NavigationMenuTrigger>Configuration</NavigationMenuTrigger>
            <NavigationMenuContent>
              <ul className="grid w-55 gap-1 p-2">
                {configurationLinks.map((link) => (
                  <li key={link.href}>
                    <NavigationMenuLink asChild>
                      <Link href={link.href}>
                        <div className="font-medium">{link.label}</div>
                        <p className="line-clamp-2 text-muted-foreground text-xs">
                          {link.description}
                        </p>
                      </Link>
                    </NavigationMenuLink>
                  </li>
                ))}
              </ul>
            </NavigationMenuContent>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    </nav>
  );
}
