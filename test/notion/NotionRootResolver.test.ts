import { describe, expect, it } from "bun:test";
import { NotionRootResolver } from "../../src/notion/NotionRootResolver.js";

describe("NotionRootResolver", () => {
  it("resolves a page root when page retrieval succeeds", async () => {
    const resolver = new NotionRootResolver(
      {
        fetchPage: async () => ({ object: "page" }),
      },
      {
        fetchDatabase: async () => {
          throw new Error("unexpected database fetch");
        },
        fetchDataSource: async () => {
          throw new Error("unexpected data source fetch");
        },
        queryRows: async () => {
          throw new Error("unexpected row query");
        },
      },
    );

    expect(await resolver.resolveRoot("0123456789abcdef0123456789abcdef")).toEqual({
      kind: "page",
      id: "01234567-89ab-cdef-0123-456789abcdef",
      sourceId: "notion://source/page/01234567-89ab-cdef-0123-456789abcdef",
    });
  });

  it("resolves a database root when page retrieval fails but database retrieval succeeds", async () => {
    const resolver = new NotionRootResolver(
      {
        fetchPage: async () => {
          throw new Error("Provided ID is a database");
        },
      },
      {
        fetchDatabase: async () => ({ object: "database" }),
        fetchDataSource: async () => {
          throw new Error("unexpected data source fetch");
        },
        queryRows: async () => {
          throw new Error("unexpected row query");
        },
      },
    );

    expect(
      await resolver.resolveRoot(
        "https://www.notion.so/awesomebobmedia/10588289beba40cb9c82c920b073fe3b?v=06f30ddb639846f6b848510c514b0df5&source=copy_link",
      ),
    ).toEqual({
      kind: "database",
      id: "10588289-beba-40cb-9c82-c920b073fe3b",
      sourceId: "notion://source/database/10588289-beba-40cb-9c82-c920b073fe3b",
    });
  });

  it("prefers database detection first for view URLs", async () => {
    let pageFetches = 0;
    let databaseFetches = 0;

    const resolver = new NotionRootResolver(
      {
        fetchPage: async () => {
          pageFetches += 1;
          throw new Error("should not need page probe first");
        },
      },
      {
        fetchDatabase: async () => {
          databaseFetches += 1;
          return { object: "database" };
        },
        fetchDataSource: async () => {
          throw new Error("unexpected data source fetch");
        },
        queryRows: async () => {
          throw new Error("unexpected row query");
        },
      },
    );

    await resolver.resolveRoot(
      "https://www.notion.so/awesomebobmedia/10588289beba40cb9c82c920b073fe3b?v=06f30ddb639846f6b848510c514b0df5&source=copy_link",
    );

    expect(databaseFetches).toBe(1);
    expect(pageFetches).toBe(0);
  });
});
