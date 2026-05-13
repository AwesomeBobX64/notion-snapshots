import { describe, expect, it } from "bun:test";
import { HttpFileDownloader } from "../../src/notion/HttpFileDownloader.js";

describe("HttpFileDownloader", () => {
  it("normalizes content-type headers by removing charset", () => {
    expect(HttpFileDownloader.normalizeMimeType("text/plain; charset=utf-8")).toBe("text/plain");
    expect(HttpFileDownloader.normalizeMimeType(null)).toBeUndefined();
  });
});
