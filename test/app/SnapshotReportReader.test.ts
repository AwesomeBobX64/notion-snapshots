import fs from "node:fs/promises";
import { afterEach, describe, expect, it } from "bun:test";
import { SnapshotReportReader } from "../../src/snapshot/SnapshotReportReader.js";
import { FileSystem } from "../../src/util/FileSystem.js";
import { SnapshotPaths } from "../../src/snapshot/SnapshotPaths.js";
import { createTempDir } from "../helpers/createTempDir.js";

describe("SnapshotReportReader", () => {
  const tempDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirectories.map((directory) => fs.rm(directory, { recursive: true, force: true })));
    tempDirectories.length = 0;
  });

  it("reads local export, import, and verify reports from a snapshot directory", async () => {
    const snapshotRoot = await createTempDir("notion-snapshots-report-reader-");
    tempDirectories.push(snapshotRoot);

    const reportPath = `${SnapshotPaths.reportsDirectory(snapshotRoot)}/export-report.md`;
    const importReportPath = `${SnapshotPaths.reportsDirectory(snapshotRoot)}/import-report.md`;
    const verifyReportPath = `${SnapshotPaths.reportsDirectory(snapshotRoot)}/verify-report.md`;
    await FileSystem.ensureDirectory(SnapshotPaths.reportsDirectory(snapshotRoot));
    await fs.writeFile(reportPath, "# Export Report\n\nHello report\n", "utf8");
    await fs.writeFile(importReportPath, "# Import Report\n\nHello import\n", "utf8");
    await fs.writeFile(verifyReportPath, "# Verify Report\n\nHello verify\n", "utf8");

    const content = await new SnapshotReportReader().read(snapshotRoot);

    expect(content).toContain("# Export Report");
    expect(content).toContain("Hello report");
    expect(content).toContain("# Import Report");
    expect(content).toContain("Hello import");
    expect(content).toContain("# Verify Report");
    expect(content).toContain("Hello verify");
  });
});
