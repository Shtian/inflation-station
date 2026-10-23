import { describe, expect, it } from "vite-plus/test";
import { parseSidebarState } from "./sidebar-state";

describe("parseSidebarState", () => {
  it("keeps known sidebar states", () => {
    expect(parseSidebarState("expanded")).toBe("expanded");
    expect(parseSidebarState("collapsed")).toBe("collapsed");
  });

  it("falls back to expanded for anything else", () => {
    expect(parseSidebarState("Collapsed")).toBe("expanded");
    expect(parseSidebarState("hidden")).toBe("expanded");
    expect(parseSidebarState("")).toBe("expanded");
    expect(parseSidebarState(null)).toBe("expanded");
    expect(parseSidebarState(undefined)).toBe("expanded");
    expect(parseSidebarState(1)).toBe("expanded");
  });
});
