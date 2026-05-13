import { describe, expect, it } from "bun:test";
import { NotionPagePropertyCodec } from "../../src/notion/NotionPagePropertyCodec.js";

const DEFAULT_ANNOTATIONS = {
  bold: false,
  italic: false,
  strikethrough: false,
  underline: false,
  code: false,
  color: "default",
} as const;

describe("NotionPagePropertyCodec", () => {
  it("normalizes page properties with property-specific handlers", () => {
    expect(
      NotionPagePropertyCodec.normalizeProperties(
        {
          Tags: {
            type: "multi_select",
            multi_select: [{ name: "Beta" }, { name: "Alpha" }],
          },
          Owner: {
            type: "people",
            people: [
              { id: "user-b", object: "user" },
              { id: "group-a", object: "group" },
            ],
          },
          Attachments: {
            type: "files",
            files: [
              {
                type: "external",
                name: "Guide",
                external: { url: "https://example.com/guide" },
              },
              {
                type: "file",
                name: "Screenshot",
              },
            ],
          },
          Formula: {
            type: "formula",
            formula: { number: 3, ignored: undefined },
          },
        },
        { Attachments: ["asset-guide", "asset-screenshot"] },
      ),
    ).toEqual({
      Tags: {
        type: "multi_select",
        value: [{ name: "Beta" }, { name: "Alpha" }],
      },
      Owner: {
        type: "people",
        value: [
          { id: "user-b", object: "user" },
          { id: "group-a", object: "group" },
        ],
      },
      Attachments: {
        type: "files",
        value: [
          {
            type: "external",
            name: "Guide",
            file_ref: "asset-guide",
            external: { url: "https://example.com/guide" },
          },
          {
            type: "file",
            name: "Screenshot",
            file_ref: "asset-screenshot",
          },
        ],
      },
      Formula: {
        type: "formula",
        value: { number: 3 },
      },
    });
  });

  it("reuses the same handlers for create and comparable property payloads", () => {
    const expectedProperties = {
      "Task Title": {
        type: "title",
        value: [
          {
            type: "text",
            plain_text: "Ship refactor",
            href: null,
            text: { content: "Ship refactor", link: null },
            annotations: DEFAULT_ANNOTATIONS,
          },
        ],
      },
      Tags: {
        type: "multi_select",
        value: [{ name: "Beta" }, { name: "Alpha" }],
      },
      Owner: {
        type: "people",
        value: [
          { id: "user-b", object: "user" },
          { id: "user-a", object: "user" },
        ],
      },
      Attachments: {
        type: "files",
        value: [
          {
            type: "external",
            name: "Guide",
            external: { url: "https://example.com/guide" },
          },
          {
            type: "file_upload",
            name: "Upload",
            file_upload: { id: "upload-1" },
          },
        ],
      },
    };

    expect(
      NotionPagePropertyCodec.propertiesForCreate({
        title: [],
        properties: expectedProperties,
      }),
    ).toEqual({
      "Task Title": {
        title: [
          {
            type: "text",
            text: { content: "Ship refactor", link: null },
            annotations: DEFAULT_ANNOTATIONS,
          },
        ],
      },
      Tags: {
        multi_select: [{ name: "Beta" }, { name: "Alpha" }],
      },
      Owner: {
        people: [
          { id: "user-b", object: "user" },
          { id: "user-a", object: "user" },
        ],
      },
      Attachments: {
        files: [
          {
            type: "external",
            name: "Guide",
            external: { url: "https://example.com/guide" },
          },
          {
            type: "file_upload",
            name: "Upload",
            file_upload: { id: "upload-1" },
          },
        ],
      },
    });

    expect(NotionPagePropertyCodec.comparableExpectedProperties(expectedProperties)).toEqual({
      "Task Title": [
        {
          type: "text",
          plain_text: "Ship refactor",
          href: null,
          text: { content: "Ship refactor", link: null },
          annotations: DEFAULT_ANNOTATIONS,
        },
      ],
      Tags: [{ name: "Alpha" }, { name: "Beta" }],
      Owner: [
        { id: "user-a", object: "user" },
        { id: "user-b", object: "user" },
      ],
      Attachments: [
        {
          type: "external",
          name: "Guide",
          external: { url: "https://example.com/guide" },
        },
        {
          type: "file",
          name: "Upload",
        },
      ],
    });

    expect(
      NotionPagePropertyCodec.comparableActualProperties(
        {
          properties: {
            Name: {
              type: "title",
              title: [
                {
                  type: "text",
                  plain_text: "Ship refactor",
                  href: null,
                  text: { content: "Ship refactor", link: null },
                  annotations: DEFAULT_ANNOTATIONS,
                },
              ],
            },
            Tags: {
              type: "multi_select",
              multi_select: [{ name: "Beta" }, { name: "Alpha" }],
            },
            Owner: {
              type: "people",
              people: [
                { id: "user-b", object: "user" },
                { id: "user-a", object: "user" },
              ],
            },
            Attachments: {
              type: "files",
              files: [
                {
                  type: "external",
                  name: "Guide",
                  external: { url: "https://example.com/guide" },
                },
                {
                  type: "file",
                  name: "Upload",
                  file_ref: "asset-upload",
                },
              ],
            },
          },
        },
        expectedProperties,
      ),
    ).toEqual({
      "Task Title": [
        {
          type: "text",
          plain_text: "Ship refactor",
          href: null,
          text: { content: "Ship refactor", link: null },
          annotations: DEFAULT_ANNOTATIONS,
        },
      ],
      Tags: [{ name: "Alpha" }, { name: "Beta" }],
      Owner: [
        { id: "user-a", object: "user" },
        { id: "user-b", object: "user" },
      ],
      Attachments: [
        {
          type: "external",
          name: "Guide",
          external: { url: "https://example.com/guide" },
        },
        {
          type: "file",
          name: "Upload",
        },
      ],
    });
  });

  it("normalizes icon and cover variants without changing comparable behavior", () => {
    expect(NotionPagePropertyCodec.normalizeIcon({ type: "emoji", emoji: "🧪" })).toEqual({
      type: "emoji",
      emoji: "🧪",
    });
    expect(
      NotionPagePropertyCodec.normalizeIcon(
        {
          type: "file",
          file: { url: "https://example.com/icon.png" },
        },
        "icon-asset",
      ),
    ).toEqual({
      type: "file",
      file_ref: "icon-asset",
    });
    expect(
      NotionPagePropertyCodec.normalizeIcon({
        type: "custom_emoji",
        custom_emoji: { name: "Party" },
      }),
    ).toEqual({
      type: "custom_emoji",
    });
    expect(
      NotionPagePropertyCodec.comparableIcon({
        type: "file_upload",
        file_upload: { id: "upload-1" },
      }),
    ).toEqual({
      type: "file",
    });
    expect(
      NotionPagePropertyCodec.restorableIcon({
        type: "external",
        external: { url: "https://example.com/icon.png" },
      }),
    ).toEqual({
      type: "external",
      external: { url: "https://example.com/icon.png" },
    });

    expect(
      NotionPagePropertyCodec.normalizeCover(
        {
          type: "file",
          file: { url: "https://example.com/cover.png" },
        },
        "cover-asset",
      ),
    ).toEqual({
      type: "file",
      file_ref: "cover-asset",
    });
    expect(
      NotionPagePropertyCodec.comparableCover({
        type: "file_upload",
        file_upload: { id: "upload-2" },
      }),
    ).toEqual({
      type: "file",
    });
    expect(
      NotionPagePropertyCodec.restorableCover({
        type: "file",
        file: { url: "https://example.com/cover.png" },
      }),
    ).toBeNull();
  });

  it("treats referenced external files as comparable file assets", () => {
    expect(
      NotionPagePropertyCodec.comparableExpectedProperties({
        Attachments: {
          type: "files",
          value: [
            {
              type: "external",
              name: "Synced external",
              file_ref: "asset-external",
              external: { url: "https://example.com/synced" },
            },
            {
              type: "external",
              name: "Public external",
              external: { url: "https://example.com/public" },
            },
            {
              type: "file_upload",
              name: "Upload",
              file_upload: { id: "upload-1" },
            },
            {
              type: "file",
              name: "Binary",
              file_ref: "asset-binary",
            },
          ],
        },
      }),
    ).toEqual({
      Attachments: [
        {
          type: "file",
          name: "Synced external",
        },
        {
          type: "external",
          name: "Public external",
          external: { url: "https://example.com/public" },
        },
        {
          type: "file",
          name: "Upload",
        },
        {
          type: "file",
          name: "Binary",
        },
      ],
    });
  });
});
