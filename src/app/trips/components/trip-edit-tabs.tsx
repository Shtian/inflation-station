"use client";

import { type ReactNode, useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type EditTab = "in-range" | "search";

export function TripEditTabs({
  initialTab,
  navigationKey,
  inRange,
  search,
}: {
  initialTab: EditTab;
  navigationKey: string;
  inRange: ReactNode;
  search: ReactNode;
}) {
  const [selection, setSelection] = useState({
    navigationKey,
    tab: initialTab,
  });
  if (selection.navigationKey !== navigationKey) {
    setSelection({ navigationKey, tab: initialTab });
  }

  useEffect(() => {
    // History can traverse away and back before the server props change.
    const resetSelection = () =>
      setSelection({ navigationKey, tab: initialTab });
    window.addEventListener("popstate", resetSelection);
    return () => window.removeEventListener("popstate", resetSelection);
  }, [initialTab, navigationKey]);

  return (
    <Tabs
      value={selection.tab}
      onValueChange={(value) => {
        if (value === "in-range" || value === "search") {
          setSelection({ navigationKey, tab: value });
        }
      }}
      className="space-y-3"
    >
      <TabsList variant="line">
        <TabsTrigger value="in-range">I perioden</TabsTrigger>
        <TabsTrigger value="search">Søk</TabsTrigger>
      </TabsList>
      <TabsContent value="in-range" keepMounted className="space-y-3">
        {inRange}
      </TabsContent>
      <TabsContent value="search" keepMounted className="space-y-3">
        {search}
      </TabsContent>
    </Tabs>
  );
}
