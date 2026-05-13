import fs from "node:fs/promises";
import { afterEach, describe, expect, it } from "bun:test";
import { SnapshotLoader } from "../../src/snapshot/SnapshotLoader.js";
import { ImportPlanner } from "../../src/import/ImportPlanner.js";
import {
  createPageTreeSnapshot,
  createRootDatabaseSnapshot,
} from "../fixtures/import/importSnapshot.fixture.js";
import { createTempDir } from "../helpers/createTempDir.js";

describe("ImportPlanner", () => {
  const tempDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirectories.map((directory) => fs.rm(directory, { recursive: true, force: true })));
    tempDirectories.length = 0;
  });

  it("plans page shell creation in parent-before-child order", async () => {
    const snapshotRoot = await createTempDir("notion-snapshots-import-plan-");
    tempDirectories.push(snapshotRoot);
    await createPageTreeSnapshot(snapshotRoot);

    const snapshot = await new SnapshotLoader().load(snapshotRoot);
    const plan = new ImportPlanner().planPageShellImport(snapshot);

    expect(plan.plan_type).toBe("import");
    expect(plan.tasks).toHaveLength(2);
    expect(plan.tasks[0]?.kind).toBe("create_page_shell");
    expect(plan.tasks[0]?.inputs.source_id).toBe("01234567-89ab-cdef-0123-456789abcdef");
    expect(plan.tasks[0]?.depends_on).toEqual([]);
    expect(plan.tasks[1]?.inputs.source_id).toBe("77777777-7777-7777-7777-777777777777");
    expect(plan.tasks[1]?.depends_on).toEqual([
      "create-page-shell:01234567-89ab-cdef-0123-456789abcdef",
    ]);
  });

  it("does not plan page shell creation for database-root snapshots", async () => {
    const snapshotRoot = await createTempDir("notion-snapshots-import-plan-database-");
    tempDirectories.push(snapshotRoot);
    await createRootDatabaseSnapshot(snapshotRoot);

    const snapshot = await new SnapshotLoader().load(snapshotRoot);
    const plan = new ImportPlanner().planPageShellImport(snapshot);

    expect(plan.plan_type).toBe("import");
    expect(plan.tasks).toEqual([]);
  });
});
