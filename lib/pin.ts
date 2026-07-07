import bcrypt from "bcryptjs";
import sql from "@/lib/db";

export interface PinUser {
  id: number;
  name: string;
  role: string;
}

export interface PinUserWithStore extends PinUser {
  storeId: number;
}

export function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10);
}

/** Finds the active user in a store whose hashed PIN matches the given plain PIN. */
export async function findUserByPin(storeId: number | string, pin: string): Promise<PinUser | null> {
  const candidates = await sql<{ id: number; name: string; role: string; pin: string | null }[]>`
    SELECT id, name, role, pin FROM users WHERE store_id = ${storeId} AND active = true AND pin IS NOT NULL
  `;
  for (const c of candidates) {
    if (await bcrypt.compare(pin, c.pin!)) {
      return { id: c.id, name: c.name, role: c.role };
    }
  }
  return null;
}

const MAX_PIN_ATTEMPTS = 5;
const PIN_LOCKOUT_MINUTES = 5;

export type PinVerifyResult<U = PinUser> =
  | { ok: true; user: U }
  | { ok: false; reason: "locked"; retryAfterSeconds: number }
  | { ok: false; reason: "invalid" };

/**
 * Verifies a PIN against a store, with lockout after MAX_PIN_ATTEMPTS consecutive
 * failures. Lockout is scoped to the store (not a specific user) because guessing
 * a 4-digit PIN is an attack on the store's ~10,000 possible codes, not one account.
 */
export async function verifyStorePin(storeId: number | string, pin: string): Promise<PinVerifyResult<PinUser>> {
  const [store] = await sql`SELECT pin_locked_until FROM stores WHERE id = ${storeId}`;
  if (!store) return { ok: false, reason: "invalid" };
  if (store.pin_locked_until && new Date(store.pin_locked_until) > new Date()) {
    const retryAfterSeconds = Math.ceil((new Date(store.pin_locked_until).getTime() - Date.now()) / 1000);
    return { ok: false, reason: "locked", retryAfterSeconds };
  }

  const user = await findUserByPin(storeId, pin);
  if (user) {
    await sql`UPDATE stores SET pin_failed_attempts = 0, pin_locked_until = NULL WHERE id = ${storeId}`;
    return { ok: true, user };
  }

  const [updated] = await sql`
    UPDATE stores SET pin_failed_attempts = pin_failed_attempts + 1 WHERE id = ${storeId}
    RETURNING pin_failed_attempts
  `;
  if (updated.pin_failed_attempts >= MAX_PIN_ATTEMPTS) {
    await sql`
      UPDATE stores SET pin_locked_until = now() + make_interval(mins => ${PIN_LOCKOUT_MINUTES}), pin_failed_attempts = 0
      WHERE id = ${storeId}
    `;
  }
  return { ok: false, reason: "invalid" };
}

/** Finds a user by store name + PIN (for staff login, before storeId is known), with the same store-scoped lockout. */
export async function verifyStoreNameAndPin(storeName: string, pin: string): Promise<PinVerifyResult<PinUserWithStore>> {
  const [store] = await sql`SELECT id FROM stores WHERE name = ${storeName}`;
  if (!store) return { ok: false, reason: "invalid" };

  const result = await verifyStorePin(store.id, pin);
  if (!result.ok) return result;
  return { ok: true, user: { ...result.user, storeId: store.id } };
}
