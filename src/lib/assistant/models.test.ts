import { describe, expect, it } from "vitest";
import { selectAssistantModelIds } from "./models";

describe("selectAssistantModelIds", () => {
  it("keeps chat models from the last 365 days with no shutdown date and no -pro, newest first", () => {
    const today = new Date("2026-10-20T12:00:00Z");

    expect(
      selectAssistantModelIds(
        [
          { id: "gpt-5.2", created: 1760961600, shutdown_date: null },
          { id: "gpt-5.1", created: 1760961599, shutdown_date: null },
          { id: "gpt-5", created: 1760875200, shutdown_date: null },
          { id: "gpt-6-sol", created: 1792000000, shutdown_date: null },
          { id: "gpt-6-pro", created: 1792000000, shutdown_date: null },
          {
            id: "gpt-5.6-terra",
            created: 1791000000,
            shutdown_date: "2027-04-01",
          },
          {
            id: "gpt-6-sol-2026-09-01",
            created: 1791500000,
            shutdown_date: null,
          },
          { id: "gpt-5.4", created: 1780000000, shutdown_date: null },
        ],
        today,
      ),
    ).toEqual(["gpt-6-sol", "gpt-5.4", "gpt-5.2"]);
  });
});
