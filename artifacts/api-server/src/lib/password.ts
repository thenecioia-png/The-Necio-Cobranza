import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;
const LEGACY_HASH_PREFIX = "$legacy$";

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, SALT_ROUNDS);
}

export function verifyPassword(password: string, hash: string | null | undefined): boolean {
  if (!hash) return false;
  if (hash.startsWith(LEGACY_HASH_PREFIX)) {
    // Legacy SHA-256 hashes are not supported anymore.
    return false;
  }
  return bcrypt.compareSync(password, hash);
}

export function isLegacyHash(hash: string | null | undefined): boolean {
  return !!hash && hash.startsWith(LEGACY_HASH_PREFIX);
}

export function markLegacyHash(originalHash: string): string {
  return `${LEGACY_HASH_PREFIX}${originalHash}`;
}

export function verifyLegacySha256(password: string, sha256Hash: string): boolean {
  const crypto = require("crypto");
  const candidate = crypto.createHash("sha256").update(password).digest("hex");
  return candidate === sha256Hash;
}
