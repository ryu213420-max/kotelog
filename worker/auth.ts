import type { Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";

export type User = { id: string; email: string; name: string; avatar: string | null };
export type AppEnv = { Bindings: Env; Variables: { user: User } };

const SESSION_DAYS = 30;

/** 利用を許可するメール（ALLOWED_EMAILS: カンマ区切り。"@example.com" でドメイン単位）。未設定なら誰も入れない */
export function isAllowed(env: Env, email: string) {
  const e = email.trim().toLowerCase();
  return (env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
    .some((a) => (a.startsWith("@") ? e.endsWith(a) : e === a));
}
const enc = new TextEncoder();

export const b64url = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export const randomToken = (bytes = 32) => b64url(crypto.getRandomValues(new Uint8Array(bytes)));

export const sha256 = async (s: string) => b64url(await crypto.subtle.digest("SHA-256", enc.encode(s)));

const cookieOpts = { httpOnly: true, secure: true, sameSite: "Lax" as const, path: "/" };

export async function createSession(c: Context<AppEnv>, userId: string) {
  const token = randomToken();
  const expires = Date.now() + SESSION_DAYS * 86400_000;
  await c.env.DB.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(await sha256(token), userId, expires)
    .run();
  setCookie(c, "sid", token, { ...cookieOpts, maxAge: SESSION_DAYS * 86400 });
}

export async function getSessionUser(c: Context<AppEnv>): Promise<User | null> {
  const token = getCookie(c, "sid");
  if (!token) return null;
  const row = await c.env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.avatar, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`,
  )
    .bind(await sha256(token))
    .first<User & { expires_at: number }>();
  if (!row || row.expires_at < Date.now() || !isAllowed(c.env, row.email)) return null;
  return { id: row.id, email: row.email, name: row.name, avatar: row.avatar };
}

export async function destroySession(c: Context<AppEnv>) {
  const token = getCookie(c, "sid");
  if (token) await c.env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(await sha256(token)).run();
  deleteCookie(c, "sid", cookieOpts);
}

export async function upsertUser(env: Env, sub: string, email: string, name: string, avatar: string | null) {
  const existing = await env.DB.prepare("SELECT id FROM users WHERE google_sub = ?").bind(sub).first<{ id: string }>();
  if (existing) {
    await env.DB.prepare("UPDATE users SET email = ?, name = ?, avatar = ? WHERE id = ?")
      .bind(email, name, avatar, existing.id)
      .run();
    return existing.id;
  }
  const id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO users (id, google_sub, email, name, avatar) VALUES (?, ?, ?, ?, ?)")
    .bind(id, sub, email, name, avatar)
    .run();
  return id;
}

/* ---------- Google OAuth 2.0 (Authorization Code + PKCE) ---------- */

export async function googleStart(c: Context<AppEnv>) {
  if (!c.env.GOOGLE_CLIENT_ID) return c.text("GOOGLE_CLIENT_ID is not configured", 500);
  const state = randomToken(16);
  const verifier = randomToken(48);
  const challenge = await sha256(verifier);
  const short = { ...cookieOpts, maxAge: 600 };
  setCookie(c, "g_state", state, short);
  setCookie(c, "g_verifier", verifier, short);
  const origin = new URL(c.req.url).origin;
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${origin}/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return c.redirect(url.toString());
}

export async function googleCallback(c: Context<AppEnv>) {
  const { code, state } = c.req.query();
  const savedState = getCookie(c, "g_state");
  const verifier = getCookie(c, "g_verifier");
  deleteCookie(c, "g_state", cookieOpts);
  deleteCookie(c, "g_verifier", cookieOpts);
  if (!code || !state || !savedState || state !== savedState || !verifier) return c.redirect("/login?error=state");

  const origin = new URL(c.req.url).origin;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: c.env.GOOGLE_CLIENT_ID,
      client_secret: c.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${origin}/auth/google/callback`,
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });
  if (!tokenRes.ok) return c.redirect("/login?error=token");
  const { access_token } = await tokenRes.json<{ access_token: string }>();

  const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { authorization: `Bearer ${access_token}` },
  });
  if (!infoRes.ok) return c.redirect("/login?error=userinfo");
  const info = await infoRes.json<{ sub: string; email: string; email_verified: boolean; name?: string; picture?: string }>();
  if (!info.email_verified) return c.redirect("/login?error=email");
  if (!isAllowed(c.env, info.email)) return c.redirect("/login?error=denied");

  const userId = await upsertUser(c.env, info.sub, info.email, info.name ?? info.email, info.picture ?? null);
  await createSession(c, userId);
  return c.redirect("/");
}

/** localhost 限定のテスト用ログイン。DEV_LOGIN=1 のときだけ有効。 */
export async function devLogin(c: Context<AppEnv>) {
  const host = new URL(c.req.url).hostname;
  if (c.env.DEV_LOGIN !== "1" || !["localhost", "127.0.0.1"].includes(host)) return c.notFound();
  const name = c.req.query("name") || "テストユーザー";
  const email = c.req.query("email") || `${encodeURIComponent(name)}@example.test`;
  if (!isAllowed(c.env, email)) return c.redirect("/login?error=denied");
  const userId = await upsertUser(c.env, `dev:${name}`, email, name, null);
  await createSession(c, userId);
  return c.redirect("/");
}

/** localhost 限定：E2E テスト用に全データを消す。DEV_LOGIN=1 のときだけ有効。 */
export async function devReset(c: Context<AppEnv>) {
  const host = new URL(c.req.url).hostname;
  if (c.env.DEV_LOGIN !== "1" || !["localhost", "127.0.0.1"].includes(host)) return c.notFound();
  await c.env.DB.batch(["records", "dogs", "sessions", "users"].map((t) => c.env.DB.prepare(`DELETE FROM ${t}`)));
  return c.json({ ok: true });
}
