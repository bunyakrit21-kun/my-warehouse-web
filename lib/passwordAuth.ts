import sql from "@/lib/db";
import bcrypt from "bcryptjs";

const MAX_PASSWORD_ATTEMPTS = 5;
const PASSWORD_LOCKOUT_MINUTES = 5;

// Real bcrypt hash of a throwaway string — compared against when the email doesn't
// exist, so unknown emails take the same time as wrong passwords (no timing leak).
const DUMMY_HASH = "$2b$10$aShctabqUqmcXHEpO8RDF.r2ikpFT.j9KGd/FKWXNEKtcBuHL.Pwq";

export interface PasswordUser {
  id: number;
  name: string;
  email: string;
  role: string;
}

export type PasswordLoginResult =
  | { ok: true; user: PasswordUser }
  | { ok: false; reason: "locked"; retryAfterMinutes: number }
  | { ok: false; reason: "invalid" };

/**
 * Shared email+password verification for web AND mobile login, with per-account
 * lockout after MAX_PASSWORD_ATTEMPTS consecutive failures. Returns "invalid" for
 * both unknown email and wrong password so responses don't reveal which emails
 * exist in the system.
 */
export async function verifyEmailPassword(email: string, password: string): Promise<PasswordLoginResult> {
  const [user] = await sql`
    SELECT id, name, email, password, role, active, failed_password_attempts, password_locked_until
    FROM users
    WHERE email = ${email}
  `;

  if (!user || !user.active) {
    await bcrypt.compare(password, DUMMY_HASH);
    return { ok: false, reason: "invalid" };
  }

  if (user.password_locked_until && new Date(user.password_locked_until) > new Date()) {
    const retryAfterMinutes = Math.ceil((new Date(user.password_locked_until).getTime() - Date.now()) / 60000);
    return { ok: false, reason: "locked", retryAfterMinutes };
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    const [updated] = await sql`
      UPDATE users SET failed_password_attempts = failed_password_attempts + 1 WHERE id = ${user.id}
      RETURNING failed_password_attempts
    `;
    if (updated.failed_password_attempts >= MAX_PASSWORD_ATTEMPTS) {
      await sql`
        UPDATE users SET failed_password_attempts = 0,
          password_locked_until = now() + make_interval(mins => ${PASSWORD_LOCKOUT_MINUTES})
        WHERE id = ${user.id}
      `;
    }
    return { ok: false, reason: "invalid" };
  }

  if (user.failed_password_attempts > 0 || user.password_locked_until) {
    await sql`UPDATE users SET failed_password_attempts = 0, password_locked_until = NULL WHERE id = ${user.id}`;
  }

  return { ok: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
}
