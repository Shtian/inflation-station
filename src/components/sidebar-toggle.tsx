"use client";

import { PanelLeft } from "lucide-react";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_SIDEBAR_STATE,
  parseSidebarState,
  SIDEBAR_STORAGE_KEY,
  type SidebarState,
} from "@/lib/sidebar-state";

function subscribeSidebar(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-sidebar"],
  });
  return () => observer.disconnect();
}

function readSidebar() {
  return parseSidebarState(document.documentElement.dataset.sidebar);
}

function readServerSidebar() {
  return DEFAULT_SIDEBAR_STATE;
}

function setSidebar(state: SidebarState) {
  document.documentElement.dataset.sidebar = state;
  try {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, state);
  } catch {
    // Storage can be unavailable (private mode, quota); the sidebar still toggles for this page.
  }
}

export function SidebarToggle() {
  const state = useSyncExternalStore(
    subscribeSidebar,
    readSidebar,
    readServerSidebar,
  );
  const expanded = state === "expanded";

  return (
    <Button
      variant="ghost"
      size="icon"
      className="hidden aria-expanded:not-hover:bg-transparent md:inline-flex"
      aria-label={expanded ? "Skjul meny" : "Vis meny"}
      aria-expanded={expanded}
      onClick={() => setSidebar(expanded ? "collapsed" : "expanded")}
    >
      <PanelLeft className="h-[1.2rem] w-[1.2rem]" />
    </Button>
  );
}
