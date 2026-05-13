import { describe, expect, it } from "bun:test";
import { ExportReportWriter } from "../../src/reports/ExportReportWriter.js";

describe("ExportReportWriter", () => {
  it("renders a markdown export summary from snapshot counts", () => {
    const markdown = ExportReportWriter.render({
      rootSourceId: "notion://source/page/01234567-89ab-cdef-0123-456789abcdef",
      status: "complete",
      counts: {
        pages: 2,
        blocks: 5,
        databases: 0,
        rows: 0,
        files: 1,
        comments: 0,
        unsupported: 0,
        failures: 0,
      },
    });

    expect(markdown).toContain("# Export Report");
    expect(markdown).toContain("- Root: `notion://source/page/01234567-89ab-cdef-0123-456789abcdef`");
    expect(markdown).toContain("- Pages exported: 2");
    expect(markdown).toContain("- Blocks exported: 5");
    expect(markdown).toContain("- Files exported: 1");
    expect(markdown).toContain("- Status: `complete`");
  });
});
