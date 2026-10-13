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
  { href: "/transactions", label: "Transaksjoner" },
  { href: "/import", label: "Import" },
  { href: "/monthly-review", label: "Månedsoppsummering" },
];

const configurationLinks = [
  {
    href: "/onboarding",
    label: "Oppsettsguide",
    description: "Snakk med en guide for å legge til kontoer og kategorier.",
  },
  {
    href: "/import/settings/message-cleanup",
    label: "Innstillinger for meldingsrydding",
    description: "Velg OpenAI-modell og prompt for rydding av importer.",
  },
  {
    href: "/monthly-review/settings",
    label: "Innstillinger for månedsoppsummering",
    description: "Rediger standard systemprompt for AI i månedsoppsummeringer.",
  },
  {
    href: "/accounts",
    label: "Kontoer",
    description: "Opprett og vedlikehold kontoene som brukes til import.",
  },
  {
    href: "/categories",
    label: "Kategorier",
    description: "Definer forbrukskategorier og kategoriregler.",
  },
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
          <NavigationMenuItem>
            <NavigationMenuTrigger>Konfigurasjon</NavigationMenuTrigger>
            <NavigationMenuContent>
              <ul className="grid w-55 gap-1 p-2">
                {configurationLinks.map((link) => (
                  <li key={link.href}>
                    <NavigationMenuLink
                      render={
                        <Link href={link.href}>
                          <div className="font-medium">{link.label}</div>
                          <p className="line-clamp-2 text-muted-foreground text-xs">
                            {link.description}
                          </p>
                        </Link>
                      }
                    />
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
