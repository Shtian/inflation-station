import { describe, expect, it } from "vite-plus/test";
import { toDeltaDirection } from "./delta";

describe("toDeltaDirection", () => {
  it("treats anything under one krone either way as flat", () => {
    expect(
      [0, 0.4, -0.99, 1, -1, 1500].map((delta) => toDeltaDirection(delta)),
    ).toEqual(["flat", "flat", "flat", "up", "down", "up"]);
  });
});
