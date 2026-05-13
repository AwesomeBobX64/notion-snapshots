import { describe, expect, it } from "bun:test";
import { SnapshotVerifyValueNormalizer } from "../../src/verify/SnapshotVerifyValueNormalizer.js";

describe("SnapshotVerifyValueNormalizer", () => {
  it("normalizes comparable rich-text segments from plain_text and text content", () => {
    expect(
      SnapshotVerifyValueNormalizer.richTextArray([
        {
          plain_text: "Alpha",
          annotations: {
            bold: true,
            color: "red",
          },
        },
        {
          text: {
            content: "Beta",
          },
          annotations: {
            italic: true,
          },
        },
        null,
      ]),
    ).toEqual([
      {
        plain_text: "Alpha",
        annotations: {
          bold: true,
          italic: false,
          strikethrough: false,
          underline: false,
          code: false,
          color: "red",
        },
      },
      {
        plain_text: "Beta",
        annotations: {
          bold: false,
          italic: true,
          strikethrough: false,
          underline: false,
          code: false,
          color: "default",
        },
      },
    ]);
  });

  it("normalizes comparable property config options", () => {
    expect(
      SnapshotVerifyValueNormalizer.propertyConfigOptions({
        options: [
          {
            name: "Todo",
            color: "gray",
            description: null,
            ignored: true,
          },
          {
            name: "Done",
            description: "Completed",
          },
          {
            color: "red",
          },
        ],
      }),
    ).toEqual({
      options: [
        {
          name: "Todo",
          color: "gray",
          description: null,
        },
        {
          name: "Done",
          description: "Completed",
        },
      ],
    });
  });

  it("normalizes supported icon payloads", () => {
    expect(
      SnapshotVerifyValueNormalizer.icon({
        type: "custom_emoji",
        custom_emoji: {
          id: "emoji-1",
          name: "party",
          url: "https://example.com/party.png",
          ignored: true,
        },
      }),
    ).toEqual({
      type: "custom_emoji",
      custom_emoji: {
        id: "emoji-1",
        name: "party",
        url: "https://example.com/party.png",
      },
    });

    expect(
      SnapshotVerifyValueNormalizer.icon({
        type: "external",
        external: {
          url: "https://example.com/icon.png",
        },
      }),
    ).toEqual({
      type: "external",
      external: {
        url: "https://example.com/icon.png",
      },
    });

    expect(SnapshotVerifyValueNormalizer.icon({ type: "file" })).toBeNull();
  });
});
