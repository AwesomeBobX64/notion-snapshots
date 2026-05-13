import { describe, expect, it } from "bun:test";
import { NotionUnsupportedFactory } from "../../src/graph/NotionUnsupportedFactory.js";

describe("NotionUnsupportedFactory", () => {
  it("builds a canonical notion.unsupported object with raw ref", () => {
    const unsupported = NotionUnsupportedFactory.createUnsupportedBlock({
      blockId: "60606060-6060-6060-6060-606060606060",
      originalType: "unsupported",
      reason: "unsupported_in_mvp",
      rawRef: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      childrenRef: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    });

    expect(unsupported.object_type).toBe("notion.unsupported");
    expect(unsupported.canonical.original_type).toBe("unsupported");
    expect(unsupported.canonical.reason).toBe("unsupported_in_mvp");
    expect(unsupported.canonical.raw_ref).toBe(
      "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    );
    expect(unsupported.canonical.children_ref).toBe(
      "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    );
  });
});
