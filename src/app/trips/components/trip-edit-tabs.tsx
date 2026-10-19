"use client";

import { type ReactNode, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type EditTab = "in-range" | "search";

/**
 * Controlled, because a search submit re-renders the page with a new initial
 * tab; an uncontrolled Tabs would warn about its default value changing.
 * Panels stay mounted so switching tabs keeps unsaved checks and search terms.
 */
export function TripEditTabs({
  initialTab,
  inRange,
  search,
}: {
  initialTab: EditTab;
  inRange: ReactNode;
  search: ReactNode;
}) {
  const [tab, setTab] = useState(initialTab);

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => setTab(value as EditTab)}
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
