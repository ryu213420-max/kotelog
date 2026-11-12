import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { api, useStats, type Stats as S } from "../api";
import { Spinner } from "../components/AddRecordSheet";
import { StatsSkeleton } from "../components/Skeletons";
import { IconSparkle } from "../components/icons";
import { Glass, Page, PressButton, rise, stagger, useToast } from "../components/ui";
import { useCurrentDog } from "../dogContext";
import { fmtNum } from "../meta";

export default function Stats() {
  const { dog } = useCurrentDog();
  const stats = useStats(dog?.id);
  if (!dog || stats.isPending || !stats.data) return <StatsSkeleton />;
  return (
    <Page>
      <h1 className="py-2 text-3xl font-black">グラフ</h1>
      <motion.div variants={stagger} initial="hidden" animate="show" className="mt-4 space-y-4">
        <WeightCard data={stats.data} />
        <WalkCard data={stats.data} />
        <AiCard dogId={dog.id} />
      </motion.div>
    </Page>
  );
}

function WeightCard({ data }: { data: S }) {
  const w = data.weights;
  const W = 320;
  const H = 150;
  const pad = 14;
  const vals = w.map((x) => x.value);
  const min = Math.min(...vals) - 0.3;
  const max = Math.max(...vals) + 0.3;
  const pts = w.map((p, i) => [pad + (i / Math.max(1, w.length - 1)) * (W - pad * 2), H - pad - ((p.value - min) / (max - min || 1)) * (H - pad * 2)] as const);
  const path = pts.map((p, i) => {
    if (i === 0) return `M${p[0]},${p[1]}`;
    const prev = pts[i - 1];
    const cx = (prev[0] + p[0]) / 2;
    return `C${cx},${prev[1]} ${cx},${p[1]} ${p[0]},${p[1]}`;
  }).join(" ");
  const area = pts.length ? `${path} L${pts.at(-1)![0]},${H} L${pts[0][0]},${H} Z` : "";
  const diff = w.length >= 2 ? w.at(-1)!.value - w[0].value : null;

  return (
    <Glass variants={rise} className="rounded-[30px] p-5" data-testid="weight-card">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-black opacity-60">体重</h2>
        {diff != null && (
          <span className="text-xs font-bold" style={{ color: "var(--weight)" }}>
            {diff >= 0 ? "+" : ""}
            {Math.abs(diff) < 0.1 ? diff.toFixed(2) : diff.toFixed(1)}kg
          </span>
        )}
      </div>
      <p className="mt-1 text-4xl font-black tabular-nums">
        {data.lastWeight ? fmtNum(data.lastWeight.value) : "—"}
        <span className="ml-1 text-base opacity-60">kg</span>
      </p>
      {w.length >= 2 ? (
        <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full overflow-visible" role="img" aria-label="体重の推移">
          <defs>
            <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--weight)" stopOpacity="0.35" />
              <stop offset="1" stopColor="var(--weight)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <motion.path d={area} fill="url(#wg)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: 0.6 }} />
          <motion.path
            d={path}
            fill="none"
            stroke="var(--weight)"
            strokeWidth="3"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.2, ease: [0.65, 0, 0.35, 1] }}
          />
          {pts.map((p, i) => (
            <motion.circle
              key={i}
              cx={p[0]}
              cy={p[1]}
              r="4"
              fill="var(--bg)"
              stroke="var(--weight)"
              strokeWidth="2.5"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3 + (i / pts.length) * 1, type: "spring", stiffness: 500, damping: 20 }}
            />
          ))}
        </svg>
      ) : (
        <p className="mt-6 pb-4 text-center text-sm font-bold opacity-50">2件以上の記録でグラフ表示</p>
      )}
    </Glass>
  );
}

function WalkCard({ data }: { data: S }) {
  const max = Math.max(30, ...data.days.map((d) => d.walk));
  const total = data.days.reduce((a, d) => a + d.walk, 0);
  return (
    <Glass variants={rise} className="rounded-[30px] p-5" data-testid="walk-card">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-black opacity-60">散歩（7日間）</h2>
        <span className="text-xs font-bold opacity-60">合計 {total}分</span>
      </div>
      <div className="mt-4 flex h-36 items-end justify-between gap-2">
        {data.days.map((d, i) => {
          const wd = new Date(d.date + "T00:00:00").toLocaleDateString("ja-JP", { weekday: "narrow" });
          return (
            <div key={d.date} className="flex flex-1 flex-col items-center gap-1.5">
              <span className="text-[10px] font-bold tabular-nums opacity-60">{d.walk || ""}</span>
              <div className="relative flex h-28 w-full items-end overflow-hidden rounded-xl bg-black/5 dark:bg-white/5">
                <motion.div
                  className="w-full rounded-xl"
                  style={{ background: "linear-gradient(180deg, color-mix(in oklab, var(--walk) 70%, white), var(--walk))" }}
                  initial={{ height: 0 }}
                  animate={{ height: `${(d.walk / max) * 100}%` }}
                  transition={{ delay: 0.2 + i * 0.06, type: "spring", stiffness: 180, damping: 20 }}
                />
              </div>
              <span className={`text-[11px] font-bold ${i === 6 ? "text-[var(--accent)]" : "opacity-60"}`}>{wd}</span>
            </div>
          );
        })}
      </div>
    </Glass>
  );
}

function AiCard({ dogId }: { dogId: string }) {
  const [text, setText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const run = async () => {
    setBusy(true);
    try {
      const r = await api<{ text: string }>("/api/ai/summary", { method: "POST", json: { dogId } });
      setText(r.text);
    } catch {
      toast("AIが応答しませんでした");
    } finally {
      setBusy(false);
    }
  };
  const lines = text?.split("\n").map((l) => l.replace(/^[\s・\-*●]+/, "").trim()).filter(Boolean) ?? [];
  return (
    <Glass variants={rise} className="relative overflow-hidden rounded-[30px] p-5" data-testid="ai-card">
      <motion.div
        aria-hidden
        className="absolute -right-10 -top-10 h-40 w-40 rounded-full blur-3xl"
        style={{ background: "var(--accent)", opacity: 0.25 }}
        animate={{ scale: busy ? [1, 1.3, 1] : 1 }}
        transition={{ repeat: busy ? Infinity : 0, duration: 1.4 }}
      />
      <div className="relative flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-black opacity-80">
          <IconSparkle size={18} className="text-[var(--accent)]" />
          AI まとめ（14日間）
        </h2>
        <PressButton onClick={run} disabled={busy} data-testid="ai-summary" className="btn-accent rounded-full px-4 py-2 text-sm font-bold disabled:opacity-60">
          {busy ? <Spinner /> : text ? "更新" : "まとめる"}
        </PressButton>
      </div>
      <AnimatePresence mode="wait">
        {busy ? (
          <motion.div key="sk" exit={{ opacity: 0 }} className="relative mt-4 space-y-2.5">
            {[0.9, 0.75, 0.82].map((w, i) => (
              <div key={i} className="sk h-4" style={{ width: `${w * 100}%` }} />
            ))}
          </motion.div>
        ) : lines.length ? (
          <motion.ul key={text} variants={stagger} initial="hidden" animate="show" className="relative mt-4 space-y-2" data-testid="ai-summary-text">
            {lines.map((l, i) => (
              <motion.li key={i} variants={rise} className="flex gap-2 text-sm font-bold leading-relaxed">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                {l}
              </motion.li>
            ))}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </Glass>
  );
}
