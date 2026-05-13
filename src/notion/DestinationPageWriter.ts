export interface CreatePageShellInput {
  parentId: string;
  title: string;
  properties?: Record<string, unknown>;
  icon?: Record<string, unknown> | null;
  cover?: Record<string, unknown> | null;
}

export interface DestinationPageWriter {
  createPageShell(input: CreatePageShellInput): Promise<string>;
}
