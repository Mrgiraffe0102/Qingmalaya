/**
 * Auth state backed by localStorage.
 *
 * Stores the JWT access token, the user's Role, and the full User object so
 * the layout can render the current user's name and filter menu items by role
 * (RolesGuard, Task 24) without an extra /me round-trip on every render.
 *
 * Key names are kept stable — other modules read these directly — and the
 * public function signatures from the placeholder are preserved so existing
 * call sites (request.ts, App.tsx) keep working unchanged.
 */
import { Role } from '@qingmalaya/shared';
import type { User } from '@qingmalaya/shared';

const TOKEN_KEY = 'qingmalaya_admin_token';
const ROLE_KEY = 'qingmalaya_admin_role';
const USER_KEY = 'qingmalaya_admin_user';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Persist token + role + optional user info after a successful login.
 * `role` defaults to OPERATOR only to preserve the legacy signature; real
 * login calls always pass the role returned by the backend.
 */
export function setToken(
  token: string,
  role: Role = Role.OPERATOR,
  user?: User,
): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(ROLE_KEY, role);
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  } catch {
    /* storage unavailable — no-op */
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ROLE_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    /* no-op */
  }
}

/** Return the stored role, or null when not logged in / unknown value. */
export function getRole(): Role | null {
  try {
    const raw = localStorage.getItem(ROLE_KEY);
    if (!raw) return null;
    // Guard against any stray invalid value — only accept known Role members.
    const known: Role[] = [
      Role.STUDENT,
      Role.TEACHER,
      Role.OPERATOR,
      Role.SUPER_ADMIN,
    ];
    return known.includes(raw as Role) ? (raw as Role) : null;
  } catch {
    return null;
  }
}

/** Return the cached User object, or null if absent / corrupt. */
export function getUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export const authStore = {
  getToken,
  setToken,
  clearToken,
  getRole,
  getUser,
  isAuthenticated,
};

export default authStore;
