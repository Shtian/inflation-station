"use client";

import { Settings } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

export function ConfigurationMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon">
            <Settings className="h-[1.2rem] w-[1.2rem]" />
            <span className="sr-only">Konfigurasjon</span>
          </Button>
        }
      />
      <DropdownMenuContent side="right" align="end" className="w-72">
        {configurationLinks.map((link) => (
          <DropdownMenuItem
            key={link.href}
            className="flex-col items-start gap-0.5 px-2 py-1.5"
            render={
              <Link href={link.href}>
                <div className="font-medium">{link.label}</div>
                <p className="line-clamp-2 text-muted-foreground text-xs">
                  {link.description}
                </p>
              </Link>
            }
          />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
