import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const value = process.env.ENCRYPTION_KEY?.trim();
  if (!value) {
    throw new Error(
      "ENCRYPTION_KEY is not set. Add a 64-character hex secret to .env, then restart the dev server.",
    );
  }

  if (/^[0-9a-fA-F]{64}$/.test(value)) {
    return Buffer.from(value, "hex");
  }

  const utf8 = Buffer.from(value, "utf8");
  if (utf8.length === 32) {
    return utf8;
  }

  const base64 = Buffer.from(value, "base64");
  if (base64.length === 32) {
    return base64;
  }

  throw new Error("ENCRYPTION_KEY must be 32 bytes (64 hex characters).");
}

export function encryptSecret(plaintext: string): {
  ciphertext: string;
  iv: string;
} {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: Buffer.concat([encrypted, tag]).toString("base64"),
    iv: iv.toString("base64"),
  };
}

export function decryptSecret(ciphertext: string, iv: string): string {
  const payload = Buffer.from(ciphertext, "base64");
  if (payload.length <= AUTH_TAG_LENGTH) {
    throw new Error("Encrypted value is invalid.");
  }

  const encrypted = payload.subarray(0, payload.length - AUTH_TAG_LENGTH);
  const tag = payload.subarray(payload.length - AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    Buffer.from(iv, "base64"),
  );
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    "utf8",
  );
}
