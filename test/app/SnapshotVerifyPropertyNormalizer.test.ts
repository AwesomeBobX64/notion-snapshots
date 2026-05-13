import { describe, expect, it } from "bun:test";
import { SnapshotVerifyPropertyNormalizer } from "../../src/verify/SnapshotVerifyPropertyNormalizer.js";

describe("SnapshotVerifyPropertyNormalizer", () => {
  it("normalizes actual schema properties with the shared schema registry", () => {
    expect(
      SnapshotVerifyPropertyNormalizer.actualSchemaProperties(
        {
          Priority: {
            type: "status",
            status: {
              options: [
                { name: "Todo", color: "gray", description: null, ignored: true },
                { name: "Done", color: "green" },
              ],
            },
          },
          Estimate: {
            type: "number",
            number: {
              format: "number",
              ignored: "extra",
            },
          },
          Ticket: {
            type: "unique_id",
            unique_id: {
              prefix: "TASK-",
              ignored: true,
            },
          },
        },
        {
          canonical: {
            properties: {
              Name: { type: "title" },
              Priority: { type: "status" },
              Estimate: { type: "number" },
              Ticket: { type: "unique_id" },
              URL: { type: "url" },
            },
          },
        },
      ),
    ).toEqual({
      Name: { title: {} },
      Priority: {
        status: {
          options: [
            { name: "Todo", color: "gray", description: null },
            { name: "Done", color: "green" },
          ],
        },
      },
      Estimate: { number: { format: "number" } },
      Ticket: { unique_id: { prefix: "TASK-" } },
      URL: { url: {} },
    });
  });
});
