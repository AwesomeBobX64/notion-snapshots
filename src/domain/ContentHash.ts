import { createHash } from "node:crypto";

export class ContentHash {
  private static readonly HASH_PATTERN = /^sha256:([a-f0-9]{64})$/;

  public static parse(value: string): ContentHash {
    return new ContentHash(value);
  }

  public static fromHex(hex: string): ContentHash {
    return new ContentHash(`sha256:${hex}`);
  }

  public static fromString(value: string): ContentHash {
    const digest = createHash("sha256").update(value, "utf8").digest("hex");
    return ContentHash.fromHex(digest);
  }

  public static fromBytes(bytes: Uint8Array): ContentHash {
    const digest = createHash("sha256").update(bytes).digest("hex");
    return ContentHash.fromHex(digest);
  }

  public readonly value: string;

  private constructor(value: string) {
    if (!ContentHash.HASH_PATTERN.test(value)) {
      throw new Error(`Invalid content hash: ${value}`);
    }

    this.value = value;
  }

  public get hex(): string {
    const match = this.value.match(ContentHash.HASH_PATTERN);

    if (!match?.[1]) {
      throw new Error(`Invalid content hash: ${this.value}`);
    }

    return match[1];
  }

  public equals(other: ContentHash): boolean {
    return this.value === other.value;
  }

  public toString(): string {
    return this.value;
  }
}
