import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { type AppEnv, destroySession, devLogin, getSessionUser, googleCallback, googleStart } from "./auth";
import { RECORD_TYPES, type AgentMsg, type RecordType, agentChat, captionPhoto, parseRecord, summarize } from "./ai";

const app = new Hono<AppEnv>();

/* ---------- auth ---------- */
app.get("/auth/google", googleStart);
app.get("/auth/google/callback", googleCallback);
app.get("/auth/dev-login", devLogin);
app.post("/auth/logout", async (c) => {
  await destroySession(c);
  return c.json({ ok: true });
});

/* ---------- api guard ---------- */
const api = new Hono<AppEnv>();

api.use("*", async (c, next) => {
  if (c.req.method !== "GET" && c.req.method !== "HEAD") {
    const origin = c.req.header("origin");
    if (origin && origin !== new URL(c.req.url).origin) throw new HTTPException(403, { message: "bad origin" });
  }
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  c.set("user", user);
  await next();
});

const bad = (msg: string) => {
  throw new HTTPException(400, { message: msg });
};
const str = (v: unknown, max = 200) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : v === "" || v == null ? null : Number.isFinite(Number(v)) ? Number(v) : null);

async function ownDog(c: { env: Env; get: (k: "user") => { id: string } }, dogId: string) {
  const dog = await c.env.DB.prepare("SELECT * FROM dogs WHERE id = ? AND user_id = ?")
    .bind(dogId, c.get("user").id)
    .first<Record<string, unknown> & { name: string }>();
  if (!dog) throw new HTTPException(404, { message: "dog not found" });
  return dog;
}

api.get("/me", (c) => c.json(c.get("user")));

/* dogs */
api.get("/dogs", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM dogs WHERE user_id = ? ORDER BY created_at")
    .bind(c.get("user").id)
    .all();
  return c.json(results);
});

function dogFields(b: Record<string, unknown>) {
  const name = str(b.name, 40);
  if (!name) bad("name required");
  const sex = b.sex === "male" || b.sex === "female" ? b.sex : null;
  const birthday = typeof b.birthday === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.birthday) ? b.birthday : null;
  return { name: name!, breed: str(b.breed, 60), sex, birthday, photo_key: str(b.photo_key, 200) };
}

api.post("/dogs", async (c) => {
  const f = dogFields(await c.req.json());
  const id = crypto.randomUUID();
  await c.env.DB.prepare("INSERT INTO dogs (id, user_id, name, breed, sex, birthday, photo_key) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(id, c.get("user").id, f.name, f.breed, f.sex, f.birthday, f.photo_key)
    .run();
  return c.json(await ownDog(c, id), 201);
});

api.patch("/dogs/:id", async (c) => {
  await ownDog(c, c.req.param("id"));
  const f = dogFields(await c.req.json());
  await c.env.DB.prepare("UPDATE dogs SET name = ?, breed = ?, sex = ?, birthday = ?, photo_key = ? WHERE id = ?")
    .bind(f.name, f.breed, f.sex, f.birthday, f.photo_key, c.req.param("id"))
    .run();
  return c.json(await ownDog(c, c.req.param("id")));
});

api.delete("/dogs/:id", async (c) => {
  await ownDog(c, c.req.param("id"));
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM records WHERE dog_id = ?").bind(c.req.param("id")),
    c.env.DB.prepare("DELETE FROM dogs WHERE id = ?").bind(c.req.param("id")),
  ]);
  return c.json({ ok: true });
});

/* records */
api.get("/dogs/:id/records", async (c) => {
  await ownDog(c, c.req.param("id"));
  const limit = Math.min(Number(c.req.query("limit")) || 50, 200);
  const before = c.req.query("before") || "9999";
  const photosOnly = c.req.query("photos") === "1";
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM records WHERE dog_id = ? AND at < ? ${photosOnly ? "AND photo_key IS NOT NULL" : ""} ORDER BY at DESC LIMIT ?`,
  )
    .bind(c.req.param("id"), before, limit)
    .all();
  return c.json(results);
});

function recordFields(b: Record<string, unknown>) {
  const type = b.type as RecordType;
  if (!RECORD_TYPES.includes(type)) bad("invalid type");
  const at = typeof b.at === "string" && !Number.isNaN(Date.parse(b.at)) ? new Date(b.at).toISOString() : new Date().toISOString();
  return { type, at, value: num(b.value), tag: str(b.tag, 20), note: str(b.note, 1000), photo_key: str(b.photo_key, 200) };
}

api.post("/dogs/:id/records", async (c) => {
  await ownDog(c, c.req.param("id"));
  const f = recordFields(await c.req.json());
  if (f.photo_key && !f.photo_key.startsWith(`${c.get("user").id}/`)) bad("invalid photo");
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    "INSERT INTO records (id, dog_id, user_id, type, at, value, tag, note, photo_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(id, c.req.param("id"), c.get("user").id, f.type, f.at, f.value, f.tag, f.note, f.photo_key)
    .run();
  return c.json(await c.env.DB.prepare("SELECT * FROM records WHERE id = ?").bind(id).first(), 201);
});

api.delete("/records/:id", async (c) => {
  const r = await c.env.DB.prepare("DELETE FROM records WHERE id = ? AND user_id = ? RETURNING photo_key")
    .bind(c.req.param("id"), c.get("user").id)
    .first<{ photo_key: string | null }>();
  if (!r) return c.json({ error: "not found" }, 404);
  if (r.photo_key) c.executionCtx.waitUntil(c.env.PHOTOS.delete(r.photo_key));
  return c.json({ ok: true });
});

/* stats */
api.get("/dogs/:id/stats", async (c) => {
  const dogId = c.req.param("id");
  await ownDog(c, dogId);
  const tz = Number(c.req.query("tz") ?? 0); // minutes offset (JS getTimezoneOffset * -1)
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const { results } = await c.env.DB.prepare(
    "SELECT type, at, value, tag FROM records WHERE dog_id = ? AND at >= ? ORDER BY at",
  )
    .bind(dogId, since)
    .all<{ type: string; at: string; value: number | null; tag: string | null }>();
  const weights = (
    await c.env.DB.prepare("SELECT at, value FROM records WHERE dog_id = ? AND type = 'weight' AND value IS NOT NULL ORDER BY at DESC LIMIT 30")
      .bind(dogId)
      .all<{ at: string; value: number }>()
  ).results.reverse();

  const dayKey = (iso: string) => new Date(Date.parse(iso) + tz * 60_000).toISOString().slice(0, 10);
  const today = dayKey(new Date().toISOString());
  const days: { date: string; walk: number; meal: number }[] = [];
  for (let i = 6; i >= 0; i--) days.push({ date: dayKey(new Date(Date.now() - i * 86400_000).toISOString()), walk: 0, meal: 0 });
  const todayCounts = { walk: 0, walkMin: 0, meal: 0, toilet: 0 };
  for (const r of results) {
    const d = days.find((x) => x.date === dayKey(r.at));
    if (d && r.type === "walk") d.walk += r.value ?? 0;
    if (d && r.type === "meal") d.meal += 1;
    if (dayKey(r.at) === today) {
      if (r.type === "walk") (todayCounts.walk += 1), (todayCounts.walkMin += r.value ?? 0);
      if (r.type === "meal") todayCounts.meal += 1;
      if (r.type === "toilet") todayCounts.toilet += 1;
    }
  }
  return c.json({ weights, days, today: todayCounts, lastWeight: weights.at(-1) ?? null });
});

/* photos */
api.post("/photos", async (c) => {
  const type = c.req.header("content-type") ?? "";
  if (!/^image\/(webp|jpeg|png)$/.test(type)) bad("unsupported image");
  const body = await c.req.arrayBuffer();
  if (body.byteLength > 5 * 1024 * 1024) bad("too large");
  const key = `${c.get("user").id}/${crypto.randomUUID()}.${type.split("/")[1]}`;
  await c.env.PHOTOS.put(key, body, { metadata: { contentType: type } });
  return c.json({ key }, 201);
});

api.get("/photos/:uid/:file", async (c) => {
  const key = `${c.req.param("uid")}/${c.req.param("file")}`;
  if (c.req.param("uid") !== c.get("user").id) return c.json({ error: "forbidden" }, 403);
  const obj = await c.env.PHOTOS.getWithMetadata<{ contentType: string }>(key, "stream");
  if (!obj.value) return c.json({ error: "not found" }, 404);
  return new Response(obj.value, {
    headers: { "content-type": obj.metadata?.contentType ?? "image/webp", "cache-control": "private, max-age=31536000, immutable" },
  });
});

/* ai */
api.post("/ai/parse", async (c) => {
  const { text } = await c.req.json<{ text?: string }>();
  const input = str(text, 300);
  if (!input) bad("text required");
  return c.json(await parseRecord(c.env, input!));
});

api.post("/ai/caption", async (c) => {
  const { key, dogId } = await c.req.json<{ key?: string; dogId?: string }>();
  if (!key || !key.startsWith(`${c.get("user").id}/`)) bad("invalid key");
  const dog = await ownDog(c, dogId ?? "");
  const obj = await c.env.PHOTOS.getWithMetadata<{ contentType: string }>(key!, "arrayBuffer");
  if (!obj.value) return c.json({ error: "not found" }, 404);
  const caption = await captionPhoto(c.env, obj.value, obj.metadata?.contentType ?? "image/webp", dog.name);
  return c.json({ caption });
});

const LABEL: Record<string, string> = { walk: "散歩", meal: "ごはん", weight: "体重", toilet: "トイレ", health: "健康", diary: "日記" };
const UNIT: Record<string, string> = { walk: "分", meal: "g", weight: "kg" };
const line = (r: { type: string; value: number | null; tag: string | null; note: string | null }) =>
  [LABEL[r.type], r.value != null ? `${r.value}${UNIT[r.type] ?? ""}` : "", r.tag ?? "", r.note ?? ""].filter(Boolean).join(" ");
api.post("/ai/summary", async (c) => {
  const { dogId } = await c.req.json<{ dogId?: string }>();
  const dog = await ownDog(c, dogId ?? "");
  const since = new Date(Date.now() - 14 * 86400_000).toISOString();
  const { results } = await c.env.DB.prepare("SELECT type, at, value, tag, note FROM records WHERE dog_id = ? AND at >= ? ORDER BY at LIMIT 150")
    .bind(dog.id, since)
    .all<{ type: string; at: string; value: number | null; tag: string | null; note: string | null }>();
  const lines = results.map((r) =>
    `${r.at.slice(0, 16).replace("T", " ")} ${line(r)}`,
  );
  return c.json({ text: await summarize(c.env, dog.name, lines) });
});

api.post("/agent", async (c) => {
  const b = await c.req.json<{ dogId?: string; messages?: AgentMsg[] }>();
  const dog = await ownDog(c, b.dogId ?? "");
  const history = (Array.isArray(b.messages) ? b.messages : [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-10)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 500) }));
  if (!history.length || history.at(-1)!.role !== "user") bad("message required");

  const since = new Date(Date.now() - 7 * 86400_000).toISOString();
  const { results } = await c.env.DB.prepare("SELECT type, at, value, tag, note FROM records WHERE dog_id = ? AND at >= ? ORDER BY at DESC LIMIT 40")
    .bind(dog.id, since)
    .all<{ type: string; at: string; value: number | null; tag: string | null; note: string | null }>();
  const tz = Number(c.req.query("tz") ?? 540);
  const local = (iso: string) => new Date(Date.parse(iso) + tz * 60_000).toISOString().slice(0, 16).replace("T", " ");
  const context = [`現在: ${local(new Date().toISOString())}`, ...results.map((r) =>
    `${local(r.at)} ${line(r)}`,
  )].join("\n");

  const birthday = dog.birthday as string | null;
  let age: string | null = null;
  if (birthday) {
    const months = Math.floor((Date.now() - Date.parse(birthday)) / (30.44 * 86400_000));
    age = months < 12 ? `${months}ヶ月` : `${Math.floor(months / 12)}歳`;
  }
  const out = await agentChat(c.env, { name: dog.name, breed: dog.breed as string | null, sex: dog.sex as string | null, age }, context, history);

  let saved = null;
  if (out.record) {
    const id = crypto.randomUUID();
    await c.env.DB.prepare("INSERT INTO records (id, dog_id, user_id, type, at, value, tag, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(id, dog.id, c.get("user").id, out.record.type, new Date().toISOString(), out.record.value, out.record.tag, out.record.note)
      .run();
    saved = await c.env.DB.prepare("SELECT * FROM records WHERE id = ?").bind(id).first();
  }
  return c.json({ reply: out.reply, record: saved });
});

app.route("/api", api);

app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
  console.error(err);
  return c.json({ error: "internal error" }, 500);
});

export default app;
