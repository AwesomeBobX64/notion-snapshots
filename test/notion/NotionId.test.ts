import { describe, expect, it } from "bun:test";
import { NotionId } from "../../src/notion/NotionId.js";

describe("NotionId", () => {
  it("normalizes a raw page id", () => {
    expect(NotionId.parsePageId("0123456789abcdef0123456789abcdef")).toBe(
      "01234567-89ab-cdef-0123-456789abcdef",
    );
  });

  it("extracts and normalizes a page id from a notion URL", () => {
    expect(
      NotionId.parsePageId(
        "https://www.notion.so/My-Page-0123456789abcdef0123456789abcdef?pvs=4",
      ),
    ).toBe("01234567-89ab-cdef-0123-456789abcdef");
  });

  it("builds a source page ref", () => {
    expect(NotionId.toSourcePageRef("01234567-89ab-cdef-0123-456789abcdef")).toBe(
      "notion://source/page/01234567-89ab-cdef-0123-456789abcdef",
    );
  });

  it("normalizes a raw block id", () => {
    expect(NotionId.parseBlockId("11111111111111111111111111111111")).toBe(
      "11111111-1111-1111-1111-111111111111",
    );
  });
});
