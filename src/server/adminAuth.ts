// Optional admin passcode for every /api/admin/* route.
// ADMIN_PASSCODE set (in .env.local) → requests must send the header `x-admin-passcode` with that value.
// Not set → the admin API is open (local demo); /admin then shows a "Demo mode: unprotected" banner.
// The passcode is never logged or echoed back.
import { createHash, timingSafeEqual } from "node:crypto";

export const ADMIN_PASSCODE_HEADER = "x-admin-passcode";

type Env = Record<string, string | undefined>;

function passcodeFrom(env: Env): string | null {
  const p = env.ADMIN_PASSCODE?.trim();
  return p ? p : null;
}

/** True when ADMIN_PASSCODE is set (non-empty). */
export function isAdminProtected(env: Env = process.env): boolean {
  return passcodeFrom(env) !== null;
}

/** Constant-time comparison (hashing first makes both sides the same length). */
function sameSecret(given: string, expected: string): boolean {
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/** True if the request may use the admin API. */
export function isAdminAllowed(req: Request, env: Env = process.env): boolean {
  const expected = passcodeFrom(env);
  if (expected === null) return true;
  const given = req.headers.get(ADMIN_PASSCODE_HEADER)?.trim() ?? "";
  return given !== "" && sameSecret(given, expected);
}

/** null when allowed; otherwise a 401 response to return as is. */
export function adminGuard(req: Request, env: Env = process.env): Response | null {
  if (isAdminAllowed(req, env)) return null;
  return Response.json({ error: "passcode_required" }, { status: 401, headers: { "Cache-Control": "no-store" } });
}
