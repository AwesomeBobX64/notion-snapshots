import { describe, expect, it } from "bun:test";
import { ImportReportWriter } from "../../src/reports/ImportReportWriter.js";

describe("ImportReportWriter", () => {
  it("renders a markdown import summary with fidelity breakdown", () => {
    const markdown = ImportReportWriter.render({
      targetPageId: "99999999-9999-9999-9999-999999999999",
      createdPages: 2,
      createdBlocks: 4,
      uploadedFiles: 1,
      preservedWithTransformation: 1,
      skippedUnsupported: 2,
      failures: 1,
      skippedByType: {
        child_database: 1,
        table: 1,
      },
      failuresByType: {
        block_append: 1,
      },
    });

    expect(markdown).toContain("# Import Report");
    expect(markdown).toContain("- Target page: `99999999-9999-9999-9999-999999999999`");
    expect(markdown).toContain("- Pages created: 2");
    expect(markdown).toContain("- Blocks replayed: 4");
    expect(markdown).toContain("- Files uploaded: 1");
    expect(markdown).toContain("- Preserved with transformation: 1");
    expect(markdown).toContain("- Skipped unsupported: 2");
    expect(markdown).toContain("- Failures: 1");
    expect(markdown).toContain("- `child_database`: 1");
    expect(markdown).toContain("- `table`: 1");
    expect(markdown).toContain("- `block_append`: 1");
  });
});
