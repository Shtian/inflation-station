"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = resolvedTheme === "dark";
  const nextTheme = isDark ? "light" : "dark";

  return (
    <Button
      type="button"
      variant="outline"
      className={cn("h-8 px-3 text-xs", className)}
      onClick={() => {
        if (!mounted) {
          return;
        }

        setTheme(nextTheme);
      }}
      disabled={!mounted}
    >
      {mounted ? (isDark ? "Light mode" : "Dark mode") : "Theme"}
    </Button>
  );
}
