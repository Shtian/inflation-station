import { describe, expect, it } from "vite-plus/test";
import { getSentryRelease } from "./release";

describe("getSentryRelease", () => {
  it("joins the package version and the build sha", () => {
    expect(getSentryRelease("0.1.0", "abc1234")).toBe(
      "inflation-station@0.1.0+abc1234",
    );
  });

  it("keeps an unknown sha visible in the release", () => {
    expect(getSentryRelease("1.2.3", "unknown")).toBe(
      "inflation-station@1.2.3+unknown",
    );
  });
});
