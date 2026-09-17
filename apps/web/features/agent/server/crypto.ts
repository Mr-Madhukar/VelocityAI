import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// AES-256-GCM encryption for BYOK provider API keys. The database only ever
// sees base64(iv | authTag | ciphertext); the 256-bit key is derived from a
// server-side secret that never leaves the environment. Without that secret
// the stored ciphertext is unreadable — including to VelocityAI operators with
// database access.

const IV_LENGTH = 12; // GCM-recommended 96-bit nonce
const TAG_LENGTH = 16;

function encryptionKey(): Buffer {
  const secret = process.env.AGENT_KEY_ENCRYPTION_SECRET ?? process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "Set AGENT_KEY_ENCRYPTION_SECRET (or BETTER_AUTH_SECRET) to store encrypted API keys.",
    );
  }
  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64");
}

export function decryptSecret(encoded: string): string {
  const raw = Buffer.from(encoded, "base64");
  const iv = raw.subarray(0, IV_LENGTH);
  const tag = raw.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = raw.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
