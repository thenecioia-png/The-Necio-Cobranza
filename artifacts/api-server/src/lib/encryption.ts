import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const ENCRYPTED_PREFIX = "enc:";

function getKey(): Buffer | null {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length !== 64) return null;
  try {
    return Buffer.from(key, "hex");
  } catch {
    return null;
  }
}

export function encrypt(text: string | null | undefined): string | null | undefined {
  if (!text) return text;
  const key = getKey();
  if (!key) return text;
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    const tag = cipher.getAuthTag().toString("hex");
    return `${ENCRYPTED_PREFIX}${iv.toString("hex")}:${tag}:${encrypted}`;
  } catch {
    return text;
  }
}

export function decrypt(data: string | null | undefined): string | null | undefined {
  if (!data || !data.startsWith(ENCRYPTED_PREFIX)) return data;
  const key = getKey();
  if (!key) return data;
  try {
    const payload = data.slice(ENCRYPTED_PREFIX.length);
    const [ivHex, tagHex, encrypted] = payload.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return data;
  }
}

export function isEncryptionEnabled(): boolean {
  return getKey() !== null;
}

export function decryptClient<T extends Record<string, any>>(client: T): T {
  return {
    ...client,
    cedula: decrypt(client.cedula) ?? client.cedula,
    phone: decrypt(client.phone) ?? client.phone,
    whatsapp: decrypt(client.whatsapp) ?? client.whatsapp,
    fiadorPhone: decrypt(client.fiadorPhone) ?? client.fiadorPhone,
  };
}

export function encryptClientFields(data: Record<string, any>): Record<string, any> {
  const result = { ...data };
  if (data.cedula !== undefined) result.cedula = encrypt(data.cedula);
  if (data.phone !== undefined) result.phone = encrypt(data.phone);
  if (data.whatsapp !== undefined) result.whatsapp = encrypt(data.whatsapp);
  if (data.fiadorPhone !== undefined) result.fiadorPhone = encrypt(data.fiadorPhone);
  return result;
}
