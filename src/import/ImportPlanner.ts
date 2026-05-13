import type { LoadedCanonicalPage, LoadedSnapshot } from "../snapshot/SnapshotLoader.js";

export interface ImportPlanTask {
  id: string;
  kind: "create_page_shell";
  depends_on: string[];
  inputs: {
    source_id: string;
    parent_source_id: string | null;
    title: string;
  };
}

export interface ImportPlan {
  plan_type: "import";
  tasks: ImportPlanTask[];
}

export class ImportPlanner {
  public planPageShellImport(snapshot: LoadedSnapshot): ImportPlan {
    const pagesById = new Map(snapshot.pages.map((page) => [page.source.id, page]));
    const tasks: ImportPlanTask[] = [];

    if (snapshot.rootPage) {
      this.appendPageTask(snapshot.rootPage.source.id, null, snapshot.pageChildren, pagesById, tasks);
    }

    return {
      plan_type: "import",
      tasks,
    };
  }

  private appendPageTask(
    pageId: string,
    parentPageId: string | null,
    pageChildren: ReadonlyMap<string, string[]>,
    pagesById: ReadonlyMap<string, LoadedCanonicalPage>,
    tasks: ImportPlanTask[],
  ): void {
    const page = pagesById.get(pageId);

    if (!page) {
      throw new Error(`Import planner could not find page ${pageId}`);
    }

    tasks.push({
      id: ImportPlanner.taskIdFor(pageId),
      kind: "create_page_shell",
      depends_on: parentPageId ? [ImportPlanner.taskIdFor(parentPageId)] : [],
      inputs: {
        source_id: pageId,
        parent_source_id: parentPageId,
        title: ImportPlanner.titleFor(page),
      },
    });

    for (const childPageId of pageChildren.get(pageId) ?? []) {
      this.appendPageTask(childPageId, pageId, pageChildren, pagesById, tasks);
    }
  }

  public static taskIdFor(pageId: string): string {
    return `create-page-shell:${pageId}`;
  }

  public static titleFor(page: LoadedCanonicalPage): string {
    const title = page.canonical.title
      .map((segment) => segment.plain_text)
      .join("")
      .trim();

    return title.length > 0 ? title : "Untitled";
  }
}
