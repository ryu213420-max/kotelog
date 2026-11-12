import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { api, useStats, type Rec } from "../api";
import { useCurrentDog } from "../dogContext";
import { recordTitle } from "../meta";
import { IconSend } from "./icons";
import { MiniDog, type DogMood } from "./MiniDog";
import { PressButton, Sheet, spring } from "./ui";

type Msg = { role: "user" | "assistant"; content: string; record?: Rec | null };

export const celebrate = () => window.dispatchEvent(new CustomEvent("wanlog:recorded"));

const SUGGEST = ["今日の様子は？", "散歩30分行ったよ", "最近の体重は？"];

export function DogAgent() {
  const { dog } = useCurrentDog();
  const stats = useStats(dog?.id);
  const { pathname } = useLocation();
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [mood, setMood] = useState<DogMood>("idle");
  const [bubble, setBubble] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const greeted = useRef<string | null>(null);

  const hour = new Date().getHours();
  const night = hour >= 22 || hour < 6;
  const baseMood: DogMood = busy ? "think" : night && !open ? "sleep" : "idle";

  // 会話はタブを閉じるまで保持（わんこごと）
  useEffect(() => {
    if (!dog) return;
    try {
      setMsgs(JSON.parse(sessionStorage.getItem(`wanlog.agent.${dog.id}`) ?? "[]"));
    } catch {
      setMsgs([]);
    }
  }, [dog?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!dog) return;
    try {
      sessionStorage.setItem(`wanlog.agent.${dog.id}`, JSON.stringify(msgs.slice(-30)));
    } catch {
      /* noop */
    }
  }, [msgs, dog]);

  // ホームでひとこと
  useEffect(() => {
    if (pathname !== "/" || !stats.data || !dog || night || greeted.current === dog.id) return;
    greeted.current = dog.id;
    const t = stats.data.today;
    const line = t.walk === 0 ? "おさんぽ行きたいワン" : t.meal === 0 && hour >= 8 ? "おなかすいたワン" : "今日もありがとうワン";
    const a = setTimeout(() => setBubble(line), 900);
    const b = setTimeout(() => setBubble(null), 5200);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [pathname, stats.data, dog, night, hour]);

  // 記録したら喜ぶ
  useEffect(() => {
    const on = () => {
      setMood("happy");
      setBubble("うれしいワン！");
      setTimeout(() => setMood("idle"), 1100);
      setTimeout(() => setBubble(null), 2400);
    };
    window.addEventListener("wanlog:recorded", on);
    return () => window.removeEventListener("wanlog:recorded", on);
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, busy]);

  if (!dog) return null;

  async function send(text = input) {
    const content = text.trim();
    if (!content || busy || !dog) return;
    const next: Msg[] = [...msgs, { role: "user", content }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    try {
      const r = await api<{ reply: string; record: Rec | null }>(`/api/agent?tz=${-new Date().getTimezoneOffset()}`, {
        method: "POST",
        json: { dogId: dog.id, messages: next.map(({ role, content }) => ({ role, content })) },
      });
      setMsgs((m) => [...m, { role: "assistant", content: r.reply, record: r.record }]);
      if (r.record) {
        qc.invalidateQueries({ queryKey: ["records", dog.id] });
        qc.invalidateQueries({ queryKey: ["stats", dog.id] });
        celebrate();
      }
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: "うまく聞こえなかったワン…" }]);
    } finally {
      setBusy(false);
    }
  }

  const show = ["/", "/stats", "/album", "/settings"].includes(pathname);

  return (
    <>
      <AnimatePresence>
        {show && !open && (
          <motion.div
            className="pointer-events-none fixed inset-x-0 z-20 mx-auto max-w-lg"
            style={{ bottom: "calc(max(env(safe-area-inset-bottom), 12px) + 76px)" }}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={spring}
          >
            <div className="relative flex items-end justify-end pr-3">
              <AnimatePresence>
                {bubble && (
                  <motion.button
                    key={bubble}
                    onClick={() => setOpen(true)}
                    data-testid="agent-bubble"
                    initial={{ opacity: 0, scale: 0.6, x: 20 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={spring}
                    className="glass glass-strong pointer-events-auto mb-9 mr-1 origin-bottom-right rounded-[18px] rounded-br-md px-3.5 py-2 text-sm font-bold"
                  >
                    {bubble}
                  </motion.button>
                )}
              </AnimatePresence>
              <motion.button
                aria-label={`${dog.name}と話す`}
                data-testid="agent"
                onClick={() => setOpen(true)}
                whileTap={{ scale: 0.88 }}
                drag
                dragSnapToOrigin
                dragElastic={0.4}
                className="pointer-events-auto touch-none"
              >
                <MiniDog mood={mood === "happy" ? "happy" : baseMood} size={78} />
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Sheet open={open} onClose={() => setOpen(false)} label={`${dog.name}と話す`}>
        <div className="flex items-center gap-2">
          <MiniDog mood={busy ? "think" : "idle"} size={56} />
          <h2 className="text-xl font-black">{dog.name}</h2>
        </div>

        <div ref={listRef} className="no-scrollbar mt-3 flex h-[46dvh] flex-col gap-2.5 overflow-y-auto pb-2" data-testid="agent-log">
          {msgs.length === 0 && !busy && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="m-auto flex flex-col items-center gap-3">
              <MiniDog mood="idle" size={120} />
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGEST.map((s, i) => (
                  <motion.button
                    key={s}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: 0.1 + i * 0.06 } }}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => send(s)}
                    className="glass rounded-full px-3.5 py-2 text-sm font-bold"
                  >
                    {s}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
          {msgs.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={spring}
              className={`max-w-[82%] ${m.role === "user" ? "self-end" : "self-start"}`}
            >
              <div
                data-testid={m.role === "user" ? "agent-user-msg" : "agent-reply"}
                className={`rounded-[20px] px-4 py-2.5 text-[15px] font-bold leading-relaxed ${
                  m.role === "user" ? "btn-accent rounded-br-md" : "glass rounded-bl-md"
                }`}
              >
                {m.content}
              </div>
              {m.record && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1, transition: { delay: 0.2, ...spring } }}
                  className="mt-1.5 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black"
                  style={{ background: "color-mix(in oklab, var(--walk) 18%, transparent)", color: "var(--walk)" }}
                  data-testid="agent-recorded"
                >
                  ✓ {recordTitle(m.record)}
                </motion.div>
              )}
            </motion.div>
          ))}
          {busy && (
            <div className="glass flex gap-1 self-start rounded-[20px] rounded-bl-md px-4 py-3.5">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="h-2 w-2 rounded-full bg-current opacity-60"
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.12 }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="glass mb-2 mt-2 flex items-center gap-2 rounded-[22px] p-1.5 pl-4">
          <input
            aria-label={`${dog.name}に話しかける`}
            data-testid="agent-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && send()}
            className="min-w-0 flex-1 bg-transparent py-2 outline-none"
          />
          <PressButton
            aria-label="送る"
            data-testid="agent-send"
            disabled={!input.trim() || busy}
            onClick={() => send()}
            className="btn-accent grid h-10 w-10 shrink-0 place-items-center rounded-full disabled:opacity-40"
          >
            <IconSend size={20} />
          </PressButton>
        </div>
      </Sheet>
    </>
  );
}
