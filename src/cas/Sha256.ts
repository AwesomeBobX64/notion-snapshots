import { ContentHash } from "../domain/ContentHash.js";
import { CanonicalJson } from "./CanonicalJson.js";

export class Sha256 {
  public static hashString(value: string): ContentHash {
    return ContentHash.fromString(value);
  }

  public static hashBytes(value: Uint8Array): ContentHash {
    return ContentHash.fromBytes(value);
  }

  public static hashCanonicalJson(value: unknown): ContentHash {
    return Sha256.hashString(CanonicalJson.stringify(value));
  }
}
