export type SidebarState = "expanded" | "collapsed";

export const DEFAULT_SIDEBAR_STATE: SidebarState = "expanded";

export const SIDEBAR_STORAGE_KEY = "inflation-station-sidebar";

export function parseSidebarState(value: unknown): SidebarState {
  return value === "collapsed" ? "collapsed" : DEFAULT_SIDEBAR_STATE;
}

// Runs before first paint so a collapsed sidebar never flashes expanded.
export const SIDEBAR_BOOT_SCRIPT = `(function(){var v=${JSON.stringify(DEFAULT_SIDEBAR_STATE)};try{if(localStorage.getItem(${JSON.stringify(SIDEBAR_STORAGE_KEY)})==="collapsed")v="collapsed"}catch(e){}document.documentElement.dataset.sidebar=v})()`;
