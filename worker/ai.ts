const VISION_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";
const TEXT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

export const RECORD_TYPES = ["walk", "meal", "weight", "toilet", "health", "diary"] as const;
export type RecordType = (typeof RECORD_TYPES)[number];

export type ParsedRecord = { type: RecordType; value: number | null; tag: string | null; note: string | null };

const mock = (env: Env) => env.AI_MOCK === "1";

function text(out: unknown): string {
  if (typeof out === "string") return out;
  const o = out as { response?: unknown; choices?: { message?: { content?: unknown } }[] };
  if (typeof o?.response === "string") return o.response;
  if (o?.response && typeof o.response === "object") return JSON.stringify(o.response);
  // OpenAI 互換形式で返すモデル
  const c = o?.choices?.[0]?.message?.content;
  if (typeof c === "string") return c;
  if (c && typeof c === "object") return JSON.stringify(c);
  return "";
}

/** 写真 → 日記風キャプション */
export async function captionPhoto(env: Env, bytes: ArrayBuffer, mime: string, dogName: string) {
  if (mock(env)) return `${dogName}がこちらを見つめている。今日もごきげんな一日。`;
  let bin = "";
  const u8 = new Uint8Array(bytes);
  for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  const dataUrl = `data:${mime};base64,${btoa(bin)}`;
  const out = await env.AI.run(VISION_MODEL as keyof AiModels, {
    messages: [
      {
        role: "system",
        content:
          "あなたは愛犬日記の書き手です。写真に写る犬の様子を、自然な日本語で日記風に1〜2文で書いてください。前置きや絵文字は不要。",
      },
      {
        role: "user",
        content: [
          { type: "text", text: `犬の名前は「${dogName}」です。` },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
    max_tokens: 200,
  } as never);
  return text(out).trim();
}

/** 自然文 → 記録 */
export async function parseRecord(env: Env, input: string): Promise<ParsedRecord> {
  if (mock(env)) return heuristicParse(input);
  const schema = {
    type: "object",
    properties: {
      type: { type: "string", enum: [...RECORD_TYPES] },
      value: { type: ["number", "null"] },
      tag: { type: ["string", "null"] },
      note: { type: ["string", "null"] },
    },
    required: ["type", "value", "tag", "note"],
  };
  try {
    const out = await env.AI.run(TEXT_MODEL as keyof AiModels, {
      messages: [
        {
          role: "system",
          content: [
            "犬の飼い主の発言を、記録データに変換してJSONで返してください。",
            "type: walk(散歩, valueは分), meal(ごはん, valueはグラム, tagは朝/昼/夜/おやつ), weight(体重, valueはkg),",
            "toilet(トイレ, tagはおしっこ/うんち), health(通院・投薬・体調), diary(その他の日記)。",
            "数値が無ければ value は null。note には補足を短く日本語で。",
          ].join("\n"),
        },
        { role: "user", content: input },
      ],
      response_format: { type: "json_schema", json_schema: schema },
      max_tokens: 200,
    } as never);
    const raw = text(out);
    const j = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
    if (!RECORD_TYPES.includes(j.type)) throw new Error("bad type");
    return {
      type: j.type,
      value: typeof j.value === "number" ? j.value : null,
      tag: j.tag || null,
      note: j.note || null,
    };
  } catch {
    return heuristicParse(input);
  }
}

export function heuristicParse(input: string): ParsedRecord {
  const num = input.match(/(\d+(?:\.\d+)?)/);
  const n = num ? Number(num[1]) : null;
  if (/散歩|さんぽ|歩/.test(input)) return { type: "walk", value: n, tag: null, note: null };
  if (/体重|kg|キロ/.test(input)) return { type: "weight", value: n, tag: null, note: null };
  if (/ごはん|ご飯|餌|フード|おやつ/.test(input)) {
    const tag = /朝/.test(input) ? "朝" : /昼/.test(input) ? "昼" : /夜|晩/.test(input) ? "夜" : /おやつ/.test(input) ? "おやつ" : null;
    return { type: "meal", value: n, tag, note: null };
  }
  if (/うんち|おしっこ|トイレ/.test(input))
    return { type: "toilet", value: null, tag: /うんち/.test(input) ? "うんち" : "おしっこ", note: null };
  if (/病院|通院|薬|ワクチン|吐/.test(input)) return { type: "health", value: null, tag: null, note: input };
  return { type: "diary", value: null, tag: null, note: input };
}

/** 直近の記録 → AI まとめ */
export async function summarize(env: Env, dogName: string, lines: string[]) {
  if (mock(env))
    return `散歩は安定して続いています。\n体重は大きな変化なし。\nごはんの時間をそろえるとさらに◎`;
  if (lines.length === 0) return "まだ記録がありません。";
  const out = await env.AI.run(TEXT_MODEL as keyof AiModels, {
    messages: [
      {
        role: "system",
        content:
          "あなたは犬の健康管理アシスタントです。記録を読み、気づきを日本語で3行の箇条書き（各40字以内、記号なし、改行区切り）で返してください。医療的な断定はしないこと。",
      },
      { role: "user", content: `犬の名前: ${dogName}\n直近の記録:\n${lines.join("\n")}` },
    ],
    max_tokens: 300,
  } as never);
  return text(out).trim();
}

/* ---------- ちっちゃい愛犬エージェント ---------- */
export type AgentMsg = { role: "user" | "assistant"; content: string };
export type AgentOut = { reply: string; record: ParsedRecord | null };

const LOOKS_LIKE_REPORT = /(散歩|さんぽ|ごはん|ご飯|フード|おやつ|体重|kg|キロ|うんち|おしっこ|トイレ|病院|通院|薬|ワクチン)/;

export async function agentChat(
  env: Env,
  dog: { name: string; breed: string | null; sex: string | null; age: string | null },
  context: string,
  history: AgentMsg[],
): Promise<AgentOut> {
  const last = history.at(-1)?.content ?? "";
  if (mock(env)) {
    if (LOOKS_LIKE_REPORT.test(last) && !/[?？]$/.test(last.trim())) {
      const rec = heuristicParse(last);
      return { reply: "記録したワン！ありがとう！", record: rec };
    }
    return { reply: `${dog.name}だワン。今日もいっしょにいてくれてうれしいワン！`, record: null };
  }
  const me = dog.sex === "male" ? "ぼく" : dog.sex === "female" ? "わたし" : dog.name;
  const system = [
    `あなたは犬の「${dog.name}」本人です（${dog.breed ?? "犬"}${dog.age ? `、${dog.age}` : ""}）。飼い主のスマホの中に住んでいて、飼い主と話します。`,
    `一人称は「${me}」。話し相手は飼い主で、飼い主のことは「パパ・ママ」ではなく「きみ」と呼ぶ。自分の名前を呼びかけに使わない。`,
    "甘えた口調の日本語で2文以内。語尾にときどき「ワン」。絵文字は使わない。",
    "",
    "やること:",
    "1. 飼い主が散歩・ごはん・体重・トイレ・通院・投薬などの出来事を報告したら record に入れ、reply でお礼や感想を言う。",
    "   record.type: walk(valueは分) / meal(valueはg, tagは朝/昼/夜/おやつ) / weight(valueはkg) / toilet(tagはおしっこ/うんち) / health(noteに内容) / diary",
    "2. 質問・雑談・予定のときは record を null にする。",
    "3. 様子や記録を聞かれたら、下の記録データから具体的な数字を拾って、自分の体験として話す。記録に無いことは無いと素直に言う。",
    "4. 体調の判断はしない。心配そうなら獣医さんに相談してねと言う。",
    "",
    "返答は JSON で、reply（きみへの返事）と、記録するときは record_type と value / tag / note を入れる。記録しないときは record_type を \"none\" にする。",
    "例（数字や内容は実際の記録データと会話に合わせること。例文をそのまま使わない）:",
    "飼い主「今日どうだった？」→ {\"reply\":\"（記録データの散歩やごはんの数字を使った感想）\",\"record_type\":\"none\",\"value\":null,\"tag\":null,\"note\":null}",
    "飼い主「夜ごはん70gあげたよ」→ {\"reply\":\"（お礼）\",\"record_type\":\"meal\",\"value\":70,\"tag\":\"夜\",\"note\":null}",
    "",
    "記録データ（新しい順）:",
    context || "（まだ記録なし）",
  ].join("\n");
  const schema = {
    type: "object",
    properties: {
      reply: { type: "string" },
      record_type: { type: "string", enum: ["none", ...RECORD_TYPES] },
      value: { type: ["number", "null"] },
      tag: { type: ["string", "null"] },
      note: { type: ["string", "null"] },
    },
    required: ["reply", "record_type", "value", "tag", "note"],
  };
  try {
    const out = await env.AI.run(TEXT_MODEL as keyof AiModels, {
      messages: [{ role: "system", content: system }, ...history.slice(-10)],
      response_format: { type: "json_schema", json_schema: schema },
      max_tokens: 300,
    } as never);
    const raw = text(out);
    const j = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
    const ok = RECORD_TYPES.includes(j.record_type);
    return {
      reply: String(j.reply ?? "").trim() || "ワン？",
      record: ok ? { type: j.record_type, value: typeof j.value === "number" ? j.value : null, tag: j.tag || null, note: j.note || null } : null,
    };
  } catch {
    return { reply: "ちょっと眠くて聞きのがしたワン…もう一回言って？", record: null };
  }
}
