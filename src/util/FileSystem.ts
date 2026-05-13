import fs from "node:fs/promises";
import path from "node:path";

export class FileSystem {
  public static async ensureDirectory(directoryPath: string): Promise<void> {
    await fs.mkdir(directoryPath, { recursive: true });
  }

  public static async ensureParentDirectory(filePath: string): Promise<void> {
    await FileSystem.ensureDirectory(path.dirname(filePath));
  }

  public static async writeJson(filePath: string, value: unknown): Promise<void> {
    await FileSystem.ensureParentDirectory(filePath);
    await fs.writeFile(filePath, JSON.stringify(value, null, 2));
  }

  public static async readJson<T>(filePath: string): Promise<T> {
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content) as T;
  }
}
