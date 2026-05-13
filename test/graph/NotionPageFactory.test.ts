import { describe, expect, it } from "bun:test";
import { NotionPageFactory } from "../../src/graph/NotionPageFactory.js";
import { ROOT_PAGE_FIXTURE } from "../fixtures/notion/rootPage.fixture.js";

describe("NotionPageFactory", () => {
  it("builds a canonical notion.page object", () => {
    const canonical = NotionPageFactory.createCanonicalPage(ROOT_PAGE_FIXTURE);

    expect(canonical.object_type).toBe("notion.page");
    expect(canonical.source.id).toBe("01234567-89ab-cdef-0123-456789abcdef");
    expect(canonical.canonical.title).toMatchObject([
      {
        type: "text",
        plain_text: "Root Page",
        href: null,
        text: {
          content: "Root Page",
          link: null,
        },
        annotations: {
          bold: false,
          italic: false,
          strikethrough: false,
          underline: false,
          code: false,
          color: "default",
        },
      },
    ]);
    expect(canonical.canonical.children_ref).toBeNull();
    expect(canonical.canonical.icon).toEqual({
      type: "emoji",
      emoji: "📘",
    });
    expect(canonical.canonical.cover).toEqual({
      type: "external",
      external: {
        url: "https://example.com/root-cover.png",
      },
    });
    expect(canonical.canonical.properties).toEqual({
      Name: {
        type: "title",
        value: canonical.canonical.title,
      },
      Status: {
        type: "status",
        value: {
          name: "Todo",
        },
      },
      Notes: {
        type: "rich_text",
        value: [
          {
            type: "text",
            plain_text: "Root page notes",
            href: null,
            text: {
              content: "Root page notes",
              link: null,
            },
            annotations: {
              bold: false,
              italic: false,
              strikethrough: false,
              underline: false,
              code: false,
              color: "default",
            },
          },
        ],
      },
      Tags: {
        type: "multi_select",
        value: [{ name: "CLI" }, { name: "Snapshot" }],
      },
      Assignee: {
        type: "people",
        value: [
          {
            id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            object: "user",
          },
        ],
      },
      Estimate: {
        type: "number",
        value: 5,
      },
      Link: {
        type: "url",
        value: "https://example.com/root-page",
      },
      Done: {
        type: "checkbox",
        value: false,
      },
      Due: {
        type: "date",
        value: {
          start: "2026-05-20",
        },
      },
      Email: {
        type: "email",
        value: "root@example.com",
      },
      Phone: {
        type: "phone_number",
        value: "555-0111",
      },
    });
    expect(canonical.content_hash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("builds a raw notion page object", () => {
    const raw = NotionPageFactory.createRawPage(
      ROOT_PAGE_FIXTURE,
      "2026-05-13T07:00:00.000Z",
    );

    expect(raw.object_type).toBe("raw.notion.page");
    expect(raw.source.id).toBe("01234567-89ab-cdef-0123-456789abcdef");
    expect(raw.source.fetched_at).toBe("2026-05-13T07:00:00.000Z");
    expect(raw.payload).toEqual(ROOT_PAGE_FIXTURE);
    expect(raw.content_hash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("preserves unsupported page property payloads canonically instead of dropping them", () => {
    const canonical = NotionPageFactory.createCanonicalPage({
      ...ROOT_PAGE_FIXTURE,
      properties: {
        ...ROOT_PAGE_FIXTURE.properties,
        Formula: {
          id: "formula",
          type: "formula",
          formula: {
            type: "string",
            string: "Computed value",
          },
        },
      },
    });

    expect(canonical.canonical.properties.Formula).toEqual({
      type: "formula",
      value: {
        string: "Computed value",
        type: "string",
      },
    });
  });

  it("preserves file-backed page assets and files properties canonically", () => {
    const canonical = NotionPageFactory.createCanonicalPage(ROOT_PAGE_FIXTURE, null, {
      icon: "sha256:1111111111111111111111111111111111111111111111111111111111111111",
      cover: "sha256:2222222222222222222222222222222222222222222222222222222222222222",
      properties: {
        Attachments: [
          "sha256:3333333333333333333333333333333333333333333333333333333333333333",
          null,
        ],
      },
    });

    const pageWithFiles = NotionPageFactory.createCanonicalPage(
      {
        ...ROOT_PAGE_FIXTURE,
        icon: {
          type: "file",
          file: {
            url: "https://files.notion.test/icon.png",
            expiry_time: "2026-05-13T08:00:00.000Z",
          },
        },
        cover: {
          type: "file",
          file: {
            url: "https://files.notion.test/cover.png",
            expiry_time: "2026-05-13T08:00:00.000Z",
          },
        },
        properties: {
          ...ROOT_PAGE_FIXTURE.properties,
          Attachments: {
            id: "attachments",
            type: "files",
            files: [
              {
                type: "file",
                name: "spec.pdf",
                file: {
                  url: "https://files.notion.test/spec.pdf",
                  expiry_time: "2026-05-13T08:00:00.000Z",
                },
              },
              {
                type: "external",
                name: "docs.txt",
                external: {
                  url: "https://example.com/docs.txt",
                },
              },
            ],
          },
        },
      },
      null,
      {
        icon: "sha256:1111111111111111111111111111111111111111111111111111111111111111",
        cover: "sha256:2222222222222222222222222222222222222222222222222222222222222222",
        properties: {
          Attachments: [
            "sha256:3333333333333333333333333333333333333333333333333333333333333333",
            null,
          ],
        },
      },
    );

    expect(canonical.canonical.icon).toEqual({
      type: "emoji",
      emoji: "📘",
    });
    expect(pageWithFiles.canonical.icon).toEqual({
      type: "file",
      file_ref: "sha256:1111111111111111111111111111111111111111111111111111111111111111",
    });
    expect(pageWithFiles.canonical.cover).toEqual({
      type: "file",
      file_ref: "sha256:2222222222222222222222222222222222222222222222222222222222222222",
    });
    expect(pageWithFiles.canonical.properties.Attachments).toEqual({
      type: "files",
      value: [
        {
          type: "file",
          name: "spec.pdf",
          file_ref: "sha256:3333333333333333333333333333333333333333333333333333333333333333",
        },
        {
          type: "external",
          name: "docs.txt",
          external: {
            url: "https://example.com/docs.txt",
          },
        },
      ],
    });
  });
});
