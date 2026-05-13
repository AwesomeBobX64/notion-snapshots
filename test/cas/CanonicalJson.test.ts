import { describe, expect, it } from "bun:test";
import { CanonicalJson } from "../../src/cas/CanonicalJson.js";

describe("CanonicalJson", () => {
  it("sorts object keys deterministically", () => {
    const input = {
      zebra: 1,
      alpha: 2,
      middle: {
        y: true,
        a: true,
      },
    };

    expect(CanonicalJson.stringify(input)).toBe(
      '{"alpha":2,"middle":{"a":true,"y":true},"zebra":1}',
    );
  });

  it("omits undefined properties while preserving nulls and array order", () => {
    const input = {
      alpha: undefined,
      beta: null,
      gamma: [3, 2, 1],
      nested: {
        skip: undefined,
        keep: "value",
      },
    };

    expect(CanonicalJson.stringify(input)).toBe(
      '{"beta":null,"gamma":[3,2,1],"nested":{"keep":"value"}}',
    );
  });
});
