import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userProviderKey } from "@/lib/db/schema";
import { decryptSecret, encryptSecret } from "@/lib/encryption";
import type { ProviderId, ProviderKeys } from "@/lib/generation/types";

export function isProviderId(value: unknown): value is ProviderId {
  return value === "google" || value === "openai";
}

export async function getStoredProviderFlags(
  userId: string,
): Promise<Record<ProviderId, boolean>> {
  const rows = await db
    .select({ provider: userProviderKey.provider })
    .from(userProviderKey)
    .where(eq(userProviderKey.userId, userId));

  const flags: Record<ProviderId, boolean> = {
    google: false,
    openai: false,
  };

  for (const row of rows) {
    if (isProviderId(row.provider)) {
      flags[row.provider] = true;
    }
  }

  return flags;
}

export async function loadDecryptedUserKeys(
  userId: string,
): Promise<ProviderKeys> {
  const rows = await db
    .select()
    .from(userProviderKey)
    .where(eq(userProviderKey.userId, userId));

  const keys: ProviderKeys = {};
  for (const row of rows) {
    if (!isProviderId(row.provider)) {
      continue;
    }
    keys[row.provider] = decryptSecret(row.ciphertext, row.iv);
  }

  return keys;
}

export async function hasStoredProviderKey(
  userId: string,
  provider: ProviderId,
): Promise<boolean> {
  const rows = await db
    .select({ provider: userProviderKey.provider })
    .from(userProviderKey)
    .where(
      and(
        eq(userProviderKey.userId, userId),
        eq(userProviderKey.provider, provider),
      ),
    )
    .limit(1);

  return rows.length > 0;
}

export async function saveUserProviderKey(
  userId: string,
  provider: ProviderId,
  apiKey: string,
): Promise<"added" | "updated"> {
  const existed = await hasStoredProviderKey(userId, provider);
  const { ciphertext, iv } = encryptSecret(apiKey);
  const updatedAt = new Date();

  await db
    .insert(userProviderKey)
    .values({
      userId,
      provider,
      ciphertext,
      iv,
      updatedAt,
    })
    .onConflictDoUpdate({
      target: [userProviderKey.userId, userProviderKey.provider],
      set: { ciphertext, iv, updatedAt },
    });

  return existed ? "updated" : "added";
}

export async function deleteUserProviderKey(
  userId: string,
  provider: ProviderId,
): Promise<boolean> {
  const existed = await hasStoredProviderKey(userId, provider);
  await db
    .delete(userProviderKey)
    .where(
      and(
        eq(userProviderKey.userId, userId),
        eq(userProviderKey.provider, provider),
      ),
    );
  return existed;
}
