import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  acceptsChatModel,
  selectChatModelIds,
  toSelectableChatModels,
} from "./chat-models";

const modelsResponse = {
  object: "list",
  data: [
    {
      id: "gpt-6.1-sol",
      object: "model",
      created: 1790552874,
      owned_by: "system",
      shutdown_date: null,
    },
    {
      id: "gpt-6-luna",
      object: "model",
      created: 1789406102,
      owned_by: "system",
      shutdown_date: null,
    },
    {
      id: "gpt-live-1",
      object: "model",
      created: 1788889407,
      owned_by: "system",
      shutdown_date: null,
    },
    {
      id: "gpt-image-2.5-flare",
      object: "model",
      created: 1788563147,
      owned_by: "system",
      shutdown_date: null,
    },
    {
      id: "gpt-6-astra",
      object: "model",
      created: 1787853604,
      owned_by: "system",
      shutdown_date: null,
    },
    {
      id: "gpt-realtime-2.1",
      object: "model",
      created: 1782254687,
      owned_by: "system",
      shutdown_date: null,
    },
    {
      id: "gpt-5.6-luna",
      object: "model",
      created: 1782228658,
      owned_by: "system",
      shutdown_date: null,
    },
    {
      id: "chat-latest",
      object: "model",
      created: 1777704602,
      owned_by: "system",
      shutdown_date: null,
    },
    {
      id: "gpt-5.5-pro-2026-04-23",
      object: "model",
      created: 1776894470,
      owned_by: "system",
      shutdown_date: null,
    },
    {
      id: "gpt-5.5",
      object: "model",
      created: 1776824847,
      owned_by: "system",
      shutdown_date: null,
    },
    {
      id: "gpt-5.4-mini",
      object: "model",
      created: 1773451123,
      owned_by: "system",
      shutdown_date: null,
    },
    {
      id: "gpt-5.4-mini-2026-03-17",
      object: "model",
      created: 1773451076,
      owned_by: "system",
      shutdown_date: null,
    },
    {
      id: "gpt-5.3-chat-latest",
      object: "model",
      created: 1772236571,
      owned_by: "system",
      shutdown_date: "2026-08-10",
    },
    {
      id: "gpt-4o-search-preview",
      object: "model",
      created: 1771905534,
      owned_by: "system",
      shutdown_date: null,
    },
    {
      id: "gpt-audio-1.5",
      object: "model",
      created: 1771550885,
      owned_by: "system",
      shutdown_date: null,
    },
    {
      id: "gpt-5.3-codex",
      object: "model",
      created: 1770537915,
      owned_by: "system",
      shutdown_date: null,
    },
    {
      id: "gpt-4o-mini-tts",
      object: "model",
      created: 1742403959,
      owned_by: "system",
      shutdown_date: null,
    },
    {
      id: "gpt-4o-mini-transcribe",
      object: "model",
      created: 1742068596,
      owned_by: "system",
      shutdown_date: "2027-02-26",
    },
    {
      id: "o4-mini",
      object: "model",
      created: 1744225351,
      owned_by: "system",
      shutdown_date: "2026-10-23",
    },
    {
      id: "o3",
      object: "model",
      created: 1744225308,
      owned_by: "system",
      shutdown_date: null,
    },
    {
      id: "o1-pro",
      object: "model",
      created: 1742251791,
      owned_by: "system",
      shutdown_date: "2026-10-23",
    },
    {
      id: "gpt-3.5-turbo-0125",
      object: "model",
      created: 1706048358,
      owned_by: "system",
      shutdown_date: "2026-10-23",
    },
    {
      id: "gpt-3.5-turbo-instruct",
      object: "model",
      created: 1692901427,
      owned_by: "system",
      shutdown_date: "2026-09-28",
    },
    {
      id: "sora-2",
      object: "model",
      created: 1759708615,
      owned_by: "system",
      shutdown_date: "2026-09-24",
    },
    {
      id: "gpt-4",
      object: "model",
      created: 1687882411,
      owned_by: "openai",
      shutdown_date: "2026-10-23",
    },
    {
      id: "gpt-3.5-turbo-16k",
      object: "model",
      created: 1683758102,
      owned_by: "openai-internal",
      shutdown_date: null,
    },
    {
      id: "text-embedding-3-large",
      object: "model",
      created: 1705953180,
      owned_by: "system",
      shutdown_date: null,
    },
    {
      id: "omni-moderation-latest",
      object: "model",
      created: 1731689265,
      owned_by: "system",
      shutdown_date: null,
    },
    {
      id: "whisper-1",
      object: "model",
      created: 1677532384,
      owned_by: "openai-internal",
      shutdown_date: "2027-02-26",
    },
    {
      id: "tts-1",
      object: "model",
      created: 1681940951,
      owned_by: "openai-internal",
      shutdown_date: null,
    },
  ],
};

const selectableOn20261011 = [
  "gpt-6.1-sol",
  "gpt-6-luna",
  "gpt-6-astra",
  "gpt-5.6-luna",
  "gpt-5.5",
  "gpt-5.4-mini",
  "o4-mini",
  "o3",
  "o1-pro",
  "gpt-4",
  "gpt-3.5-turbo-16k",
];

describe("selectChatModelIds", () => {
  it("keeps current chat models newest first and drops other families, snapshots and shut-down models", () => {
    expect(
      selectChatModelIds(modelsResponse.data, new Date("2026-10-11T12:00:00Z")),
    ).toEqual(selectableOn20261011);
  });

  it("drops models on their shutdown date", () => {
    expect(
      selectChatModelIds(modelsResponse.data, new Date("2026-10-23T00:00:00Z")),
    ).toEqual([
      "gpt-6.1-sol",
      "gpt-6-luna",
      "gpt-6-astra",
      "gpt-5.6-luna",
      "gpt-5.5",
      "gpt-5.4-mini",
      "o3",
      "gpt-3.5-turbo-16k",
    ]);
  });

  it("orders models created in the same second by id", () => {
    expect(
      selectChatModelIds(
        [
          { id: "gpt-5-mini", created: 100, shutdown_date: null },
          { id: "gpt-5", created: 100, shutdown_date: null },
          { id: "gpt-6", created: 200, shutdown_date: null },
        ],
        new Date("2026-10-11T12:00:00Z"),
      ),
    ).toEqual(["gpt-6", "gpt-5", "gpt-5-mini"]);
  });
});

describe("listChatModels", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers({
      toFake: ["Date"],
      now: new Date("2026-10-11T12:00:00Z"),
    });
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  async function listChatModelsFresh() {
    const { listChatModels } = await import("./chat-models");
    return listChatModels;
  }

  function stubFetch(response: () => Response | Promise<Response>) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response()),
    );
  }

  it("returns the selectable ids from OpenAI", async () => {
    stubFetch(() => Response.json(modelsResponse));
    const listChatModels = await listChatModelsFresh();

    await expect(listChatModels()).resolves.toEqual({
      source: "openai",
      ids: selectableOn20261011,
    });
  });

  it("serves a successful list from memory for an hour", async () => {
    stubFetch(() => Response.json(modelsResponse));
    const listChatModels = await listChatModelsFresh();
    await listChatModels();

    stubFetch(() => Promise.reject(new TypeError("fetch failed")));
    vi.setSystemTime(new Date("2026-10-11T12:59:00Z"));
    await expect(listChatModels()).resolves.toEqual({
      source: "openai",
      ids: selectableOn20261011,
    });

    vi.setSystemTime(new Date("2026-10-11T13:01:00Z"));
    await expect(listChatModels()).resolves.toEqual({ source: "unavailable" });
  });

  it("is unavailable when OpenAI answers with a non-2xx status, and retries next time", async () => {
    stubFetch(() => Response.json({ error: "nope" }, { status: 401 }));
    const listChatModels = await listChatModelsFresh();

    await expect(listChatModels()).resolves.toEqual({ source: "unavailable" });

    stubFetch(() => Response.json(modelsResponse));
    await expect(listChatModels()).resolves.toEqual({
      source: "openai",
      ids: selectableOn20261011,
    });
  });

  it("is unavailable when the body is not a model list", async () => {
    stubFetch(() => Response.json({ data: [{ id: "gpt-6" }] }));
    const listChatModels = await listChatModelsFresh();

    await expect(listChatModels()).resolves.toEqual({ source: "unavailable" });
  });

  it("is unavailable without an API key", async () => {
    vi.stubEnv("OPENAI_API_KEY", " ");
    stubFetch(() => Response.json(modelsResponse));
    const listChatModels = await listChatModelsFresh();

    await expect(listChatModels()).resolves.toEqual({ source: "unavailable" });
  });
});

describe("acceptsChatModel", () => {
  it("accepts only listed ids when OpenAI answered", () => {
    const list = { source: "openai" as const, ids: ["gpt-6", "o3"] };

    expect(acceptsChatModel(list, "o3")).toBe(true);
    expect(acceptsChatModel(list, "gpt-4o")).toBe(false);
  });

  it("accepts any id when the list is unavailable", () => {
    expect(acceptsChatModel({ source: "unavailable" }, "gpt-4o")).toBe(true);
  });
});

describe("toSelectableChatModels", () => {
  const models = { resolvedModelId: "gpt-5.4", defaultModelId: "gpt-5.4" };

  it("lists the OpenAI ids when they include the resolved model", () => {
    expect(
      toSelectableChatModels(
        { source: "openai", ids: ["gpt-6", "gpt-5.4"] },
        models,
      ),
    ).toEqual({
      availableModels: ["gpt-6", "gpt-5.4"],
      availableModelsSource: "openai",
    });
  });

  it("puts a resolved model OpenAI no longer lists first", () => {
    expect(
      toSelectableChatModels(
        { source: "openai", ids: ["gpt-6", "o3"] },
        models,
      ),
    ).toEqual({
      availableModels: ["gpt-5.4", "gpt-6", "o3"],
      availableModelsSource: "openai",
    });
  });

  it("falls back to the resolved and default models when unavailable", () => {
    expect(
      toSelectableChatModels(
        { source: "unavailable" },
        { resolvedModelId: "gpt-6", defaultModelId: "gpt-5.4" },
      ),
    ).toEqual({
      availableModels: ["gpt-6", "gpt-5.4"],
      availableModelsSource: "unavailable",
    });
    expect(toSelectableChatModels({ source: "unavailable" }, models)).toEqual({
      availableModels: ["gpt-5.4"],
      availableModelsSource: "unavailable",
    });
  });
});
