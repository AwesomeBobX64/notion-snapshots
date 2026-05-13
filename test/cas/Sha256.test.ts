import { describe, expect, it } from "bun:test";
import { CanonicalJson } from "../../src/cas/CanonicalJson.js";
import { Sha256 } from "../../src/cas/Sha256.js";

describe("Sha256", () => {
  it("produces the same hash for equivalent canonical objects", () => {
    const left = { b: 2, a: 1 };
    const right = { a: 1, b: 2 };

    expect(Sha256.hashCanonicalJson(left).toString()).toBe(
      Sha256.hashCanonicalJson(right).toString(),
    );
  });

  it("matches hashing canonical JSON as a string", () => {
    const input = { z: 1, a: 2 };

    expect(Sha256.hashCanonicalJson(input).toString()).toBe(
      Sha256.hashString(CanonicalJson.stringify(input)).toString(),
    );
  });
});
