import { ContentHash } from "../domain/ContentHash.js";
import type { LoadedCanonicalDatabase } from "../domain/CanonicalNotionDatabase.js";
import type { SnapshotManifestData } from "../domain/SnapshotManifest.js";
import { ManifestRepository } from "../cas/ManifestRepository.js";
import { ObjectStore } from "../cas/ObjectStore.js";
import { SnapshotArchive } from "./SnapshotArchive.js";
import type { CanonicalRichText } from "../graph/NotionRichText.js";

export interface LoadedCanonicalPage {
  object_type: "notion.page";
  content_hash: string;
  source: {
    id: string;
  };
  canonical: {
    title: CanonicalRichText[];
    icon: Record<string, unknown> | null;
    cover: Record<string, unknown> | null;
    properties: Record<string, unknown>;
    children_ref: string | null;
  };
}

export interface LoadedCanonicalBlock {
  object_type: "notion.block";
  content_hash: string;
  source: {
    id: string;
  };
  canonical: {
    block_type: string;
    payload: Record<string, unknown>;
    children_ref: string | null;
  };
}

export interface LoadedUnsupportedBlock {
  object_type: "notion.unsupported";
  content_hash: string;
  source: {
    id: string;
  };
  canonical: {
    kind: "block";
    original_type: string;
    reason: string;
    raw_ref: string;
    children_ref: string | null;
  };
}

export interface LoadedChildren {
  object_type: "notion.children";
  content_hash: string;
  children: {
    source_id: string;
    ref: string;
  }[];
}

export interface LoadedSnapshot {
  snapshotRoot: string;
  manifest: SnapshotManifestData;
  rootObject: LoadedCanonicalPage | LoadedCanonicalDatabase;
  rootPage: LoadedCanonicalPage | null;
  rootDatabase: LoadedCanonicalDatabase | null;
  pages: LoadedCanonicalPage[];
  pageChildren: Map<string, string[]>;
  pageBlocks: Map<string, LoadedBlockNode[]>;
  cleanup: (() => Promise<void>) | undefined;
}

export interface LoadedBlockNode {
  block: LoadedCanonicalBlock | LoadedUnsupportedBlock;
  children: LoadedBlockNode[];
}

export class SnapshotLoader {
  public async load(snapshotPath: string): Promise<LoadedSnapshot> {
    const workspace = await SnapshotArchive.resolveReadableWorkspace(snapshotPath);

    try {
      const manifest = (await new ManifestRepository(workspace.rootPath).load()).toJSON();

      if (!manifest.root.content_hash) {
        throw new Error("Snapshot root content hash is missing");
      }

      const objectStore = new ObjectStore(workspace.rootPath);
      const rootObject = await objectStore.get<LoadedCanonicalPage | LoadedCanonicalDatabase>(
        ContentHash.parse(manifest.root.content_hash),
      );

      const pages: LoadedCanonicalPage[] = [];
      const pageChildren = new Map<string, string[]>();
      const pageBlocks = new Map<string, LoadedBlockNode[]>();
      const visited = new Set<string>();

      if (rootObject.object_type === "notion.page") {
        await this.collectPages(rootObject, objectStore, pages, pageChildren, pageBlocks, visited);
      }

      return {
        snapshotRoot: workspace.rootPath,
        manifest,
        rootObject,
        rootPage: rootObject.object_type === "notion.page" ? rootObject : null,
        rootDatabase: rootObject.object_type === "notion.database" ? rootObject : null,
        pages,
        pageChildren,
        pageBlocks,
        cleanup: workspace.cleanup,
      };
    } catch (error) {
      await workspace.cleanup?.();
      throw error;
    }
  }

  private async collectPages(
    page: LoadedCanonicalPage,
    objectStore: ObjectStore,
    pages: LoadedCanonicalPage[],
    pageChildren: Map<string, string[]>,
    pageBlocks: Map<string, LoadedBlockNode[]>,
    visited: Set<string>,
  ): Promise<void> {
    if (visited.has(page.source.id)) {
      return;
    }

    visited.add(page.source.id);
    pages.push(page);

    if (!page.canonical.children_ref) {
      pageChildren.set(page.source.id, []);
      pageBlocks.set(page.source.id, []);
      return;
    }

    const blocks = await this.loadBlockNodes(page.canonical.children_ref, objectStore);
    pageBlocks.set(page.source.id, blocks);

    const childPageIds: string[] = [];

    for (const node of blocks) {
      if (node.block.object_type !== "notion.block" || node.block.canonical.block_type !== "child_page") {
        continue;
      }

      const pageRef = node.block.canonical.payload.page_ref;

      if (typeof pageRef !== "string") {
        continue;
      }

      const childPage = await objectStore.get<LoadedCanonicalPage>(ContentHash.parse(pageRef));
      childPageIds.push(childPage.source.id);
      await this.collectPages(childPage, objectStore, pages, pageChildren, pageBlocks, visited);
    }

    pageChildren.set(page.source.id, childPageIds);
  }

  public async loadBlockNodes(
    childrenRef: string,
    objectStore: ObjectStore,
  ): Promise<LoadedBlockNode[]> {
    const children = await objectStore.get<LoadedChildren>(ContentHash.parse(childrenRef));
    const nodes: LoadedBlockNode[] = [];

    for (const child of children.children) {
      const block = await objectStore.get<LoadedCanonicalBlock | LoadedUnsupportedBlock>(
        ContentHash.parse(child.ref),
      );
      const nestedChildrenRef = this.childrenRefFor(block);
      const nestedChildren = nestedChildrenRef
        ? await this.loadBlockNodes(nestedChildrenRef, objectStore)
        : [];

      nodes.push({
        block,
        children: nestedChildren,
      });
    }

    return nodes;
  }

  private childrenRefFor(
    block: LoadedCanonicalBlock | LoadedUnsupportedBlock,
  ): string | null {
    return typeof block.canonical.children_ref === "string" ? block.canonical.children_ref : null;
  }
}
