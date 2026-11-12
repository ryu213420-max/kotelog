import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { api, uploadPhoto, useAddRecord, type RecordType } from "../api";
import { useCurrentDog } from "../dogContext";
import { TYPES, toLocalInput, typeMeta } from "../meta";
import { IconCamera, IconClose, IconMic, IconSend, IconSparkle } from "./icons";
import { PressButton, Sheet, spring, useToast } from "./ui";
import { celebrate } from "./DogAgent";

type SR = { start(): void; stop(): void; lang: string; interimResults: boolean; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend: () => void; onerror: () => void };
const getSR = (): (new () => SR) | null =>
  (window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR }).SpeechRecognition ??
  (window as unknown as { webkitSpeechRecognition?: new () => SR }).webkitSpeechRecognition ??
  null;

export function AddRecordSheet({ open, onClose, initialType }: { open: boolean; onClose: () => void; initialType?: RecordType }) {
  const { dog } = useCurrentDog();
  const add = useAddRecord(dog?.id);
  const toast = useToast();

  const [type, setType] = useState<RecordType>("walk");
  const [value, setValue] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [at, setAt] = useState(toLocalInput());
  const [photo, setPhoto] = useState<{ key: string | null; preview: string } | null>(null);
  const [quick, setQuick] = useState("");
  const [aiBusy, setAiBusy] = useState<"parse" | "caption" | null>(null);
  const [listening, setListening] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const srRef = useRef<SR | null>(null);

  useEffect(() => {
    if (!open) return;
    setType(initialType ?? "walk");
    setValue("");
    setTag(null);
    setNote("");
    setAt(toLocalInput());
    setPhoto(null);
    setQuick("");
  }, [open, initialType]);

  const meta = typeMeta(type);

  const typewrite = (text: string) => {
    setNote("");
    let i = 0;
    const t = setInterval(() => {
      i += 2;
      setNote(text.slice(0, i));
      if (i >= text.length) clearInterval(t);
    }, 18);
  };

  async function runParse(text = quick) {
    if (!text.trim()) return;
    setAiBusy("parse");
    try {
      const r = await api<{ type: RecordType; value: number | null; tag: string | null; note: string | null }>("/api/ai/parse", {
        method: "POST",
        json: { text },
      });
      setType(r.type);
      setValue(r.value != null ? String(r.value) : "");
      setTag(r.tag);
      if (r.note) typewrite(r.note);
      setQuick("");
    } catch {
      toast("読み取れませんでした");
    } finally {
      setAiBusy(null);
    }
  }

  function toggleMic() {
    const SRC = getSR();
    if (!SRC) return toast("この端末は音声入力に未対応です");
    if (listening) return srRef.current?.stop();
    const sr = new SRC();
    sr.lang = "ja-JP";
    sr.interimResults = true;
    let finalText = "";
    sr.onresult = (e) => {
      finalText = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join("");
      setQuick(finalText);
    };
    sr.onend = () => {
      setListening(false);
      if (finalText) runParse(finalText);
    };
    sr.onerror = () => setListening(false);
    srRef.current = sr;
    setListening(true);
    sr.start();
  }

  async function onFile(f: File | undefined) {
    if (!f) return;
    const preview = URL.createObjectURL(f);
    setPhoto({ key: null, preview });
    try {
      const key = await uploadPhoto(f);
      setPhoto({ key, preview });
    } catch {
      toast("写真をアップロードできませんでした");
      setPhoto(null);
    }
  }

  async function caption() {
    if (!photo?.key || !dog) return;
    setAiBusy("caption");
    try {
      const r = await api<{ caption: string }>("/api/ai/caption", { method: "POST", json: { key: photo.key, dogId: dog.id } });
      typewrite(r.caption);
    } catch {
      toast("AIが応答しませんでした");
    } finally {
      setAiBusy(null);
    }
  }

  async function save() {
    if (photo && !photo.key) return toast("写真をアップロード中です");
    if (type === "weight" && !value) return toast("体重を入力してください");
    try {
      await add.mutateAsync({
        type,
        value: value === "" ? null : Number(value),
        tag,
        note: note || null,
        at: new Date(at).toISOString(),
        photo_key: photo?.key ?? null,
      });
      toast(`${meta.label}を記録しました`);
      celebrate();
      onClose();
    } catch {
      toast("保存できませんでした");
    }
  }

  return (
    <Sheet open={open} onClose={onClose} label="記録する">
      <h2 className="mb-4 text-xl font-black">記録する</h2>

      {/* AI quick input */}
      <div className="glass flex items-center gap-2 rounded-[22px] p-1.5 pl-3">
        <IconSparkle size={20} className="shrink-0 text-[var(--accent)]" />
        <input
          aria-label="AIクイック入力"
          data-testid="ai-input"
          value={quick}
          onChange={(e) => setQuick(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && runParse()}
          placeholder="朝ごはん 80g"
          className="min-w-0 flex-1 bg-transparent py-2 outline-none placeholder:opacity-50"
        />
        <PressButton
          aria-label={listening ? "音声入力を停止" : "音声入力"}
          onClick={toggleMic}
          className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-full ${listening ? "text-white" : ""}`}
          style={listening ? { background: "var(--health)" } : undefined}
        >
          {listening && (
            <motion.span
              className="absolute inset-0 rounded-full"
              style={{ background: "var(--health)" }}
              animate={{ scale: [1, 1.6], opacity: [0.5, 0] }}
              transition={{ repeat: Infinity, duration: 1.1 }}
            />
          )}
          <IconMic size={20} className="relative" />
        </PressButton>
        <PressButton
          aria-label="AIで入力"
          data-testid="ai-submit"
          onClick={() => runParse()}
          disabled={!quick.trim() || !!aiBusy}
          className="btn-accent grid h-10 w-10 shrink-0 place-items-center rounded-full disabled:opacity-40"
        >
          {aiBusy === "parse" ? <Spinner /> : <IconSend size={20} />}
        </PressButton>
      </div>

      {/* type selector */}
      <div className="mt-5 grid grid-cols-6 gap-1.5" role="radiogroup" aria-label="種類">
        {TYPES.map((t) => (
          <button
            key={t.type}
            role="radio"
            aria-checked={type === t.type}
            onClick={() => {
              setType(t.type);
              setTag(null);
              setValue("");
            }}
            className="relative flex flex-col items-center gap-1 rounded-2xl py-2.5 text-[11px] font-bold"
            style={{ color: type === t.type ? "white" : t.color }}
          >
            {type === t.type && (
              <motion.span layoutId="type-pill" className="absolute inset-0 rounded-2xl" style={{ background: t.color }} transition={spring} />
            )}
            <span className="relative">{t.icon(22)}</span>
            <span className="relative">{t.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={type}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.16 }}
          className="mt-5 space-y-4"
        >
          {meta.unit && (
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold opacity-60">{meta.valueLabel}</span>
              <div className="flex items-center gap-2">
                <PressButton
                  aria-label="減らす"
                  onClick={() => setValue((v) => String(Math.max(0, +((Number(v) || 0) - (meta.step ?? 1)).toFixed(1))))}
                  className="glass grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-xl font-black"
                >
                  −
                </PressButton>
                <div className="relative flex-1">
                  <input
                    aria-label={meta.valueLabel}
                    data-testid="value-input"
                    inputMode="decimal"
                    value={value}
                    onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ""))}
                    className="field text-center text-2xl font-black"
                    placeholder="0"
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold opacity-50">{meta.unit}</span>
                </div>
                <PressButton
                  aria-label="増やす"
                  onClick={() => setValue((v) => String(+((Number(v) || 0) + (meta.step ?? 1)).toFixed(1)))}
                  className="glass grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-xl font-black"
                >
                  +
                </PressButton>
              </div>
            </label>
          )}

          {meta.tags && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="区分">
              {meta.tags.map((t) => (
                <motion.button
                  key={t}
                  whileTap={{ scale: 0.92 }}
                  aria-pressed={tag === t}
                  onClick={() => setTag(tag === t ? null : t)}
                  className="rounded-full px-4 py-2 text-sm font-bold transition-colors"
                  style={
                    tag === t
                      ? { background: meta.color, color: "white" }
                      : { background: `color-mix(in oklab, ${meta.color} 14%, transparent)`, color: meta.color }
                  }
                >
                  {t}
                </motion.button>
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* photo */}
      <div className="mt-4">
        <input ref={fileRef} type="file" accept="image/*" hidden data-testid="photo-input" onChange={(e) => onFile(e.target.files?.[0])} />
        <AnimatePresence mode="wait">
          {photo ? (
            <motion.div
              key="p"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative overflow-hidden rounded-[22px]"
            >
              <img src={photo.preview} alt="選択した写真" className="aspect-[4/3] w-full object-cover" />
              {!photo.key && <div className="sk absolute inset-0 !rounded-none opacity-70" />}
              <button
                aria-label="写真を外す"
                onClick={() => setPhoto(null)}
                className="glass absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full text-white"
              >
                <IconClose size={18} />
              </button>
              <PressButton
                onClick={caption}
                disabled={!photo.key || !!aiBusy}
                data-testid="ai-caption"
                className="glass absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {aiBusy === "caption" ? <Spinner /> : <IconSparkle size={18} />}
                AIで文章にする
              </PressButton>
            </motion.div>
          ) : (
            <motion.button
              key="b"
              whileTap={{ scale: 0.97 }}
              onClick={() => fileRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-[22px] border-2 border-dashed border-current/20 py-4 text-sm font-bold opacity-70"
            >
              <IconCamera size={20} />
              写真
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <textarea
        aria-label="メモ"
        data-testid="note-input"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="メモ"
        className="field mt-4 resize-none"
      />

      <label className="mt-3 flex items-center justify-between gap-3">
        <span className="text-xs font-bold opacity-60">日時</span>
        <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} className="field !w-auto !py-2 text-sm" />
      </label>

      <PressButton
        onClick={save}
        disabled={add.isPending}
        data-testid="save-record"
        className="btn-accent mb-2 mt-5 h-14 w-full rounded-[22px] text-lg font-black disabled:opacity-60"
      >
        {add.isPending ? <Spinner /> : "保存"}
      </PressButton>
    </Sheet>
  );
}

export const Spinner = () => (
  <motion.span
    className="mx-auto block h-5 w-5 rounded-full border-2 border-current border-t-transparent"
    animate={{ rotate: 360 }}
    transition={{ repeat: Infinity, duration: 0.7, ease: "linear" }}
  />
);
