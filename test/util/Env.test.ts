import { describe, expect, it } from "bun:test";
import { Env } from "../../src/util/Env.js";

describe("Env", () => {
  it("prefers an explicit source token over environment variables", () => {
    const token = Env.resolveNotionToken({
      explicitToken: "explicit-token",
      role: "source",
      environment: {
        NOTION_SOURCE_TOKEN: "source-token",
        NOTION_TOKEN: "generic-token",
      },
    });

    expect(token).toBe("explicit-token");
  });

  it("uses source-specific token before generic token", () => {
    const token = Env.resolveNotionToken({
      role: "source",
      environment: {
        NOTION_SOURCE_TOKEN: "source-token",
        NOTION_TOKEN: "generic-token",
      },
    });

    expect(token).toBe("source-token");
  });

  it("falls back to a generic token", () => {
    const token = Env.resolveNotionToken({
      role: "destination",
      environment: {
        NOTION_TOKEN: "generic-token",
      },
    });

    expect(token).toBe("generic-token");
  });
});
