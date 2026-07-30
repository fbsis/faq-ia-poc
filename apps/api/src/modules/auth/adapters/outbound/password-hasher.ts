import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { PasswordHasher } from "../../../../shared/domain/ports.js";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

export class ScryptPasswordHasher implements PasswordHasher {
  async hash(value: string): Promise<string> {
    const salt = randomBytes(16).toString("hex");
    const derived = (await scrypt(value, salt, KEY_LENGTH)) as Buffer;
    return `scrypt:${salt}:${derived.toString("hex")}`;
  }

  async verify(value: string, encoded: string): Promise<boolean> {
    const [algorithm, salt, hash] = encoded.split(":");
    if (algorithm !== "scrypt" || !salt || !hash) return false;

    const expected = Buffer.from(hash, "hex");
    const actual = (await scrypt(value, salt, expected.length)) as Buffer;
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }
}
