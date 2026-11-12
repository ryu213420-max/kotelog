import { AnimatePresence, motion, useMotionValue, useTransform } from "motion/react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { photoUrl, useDeleteRecord, useRecords, useStats, type Rec, type RecordType } from "../api";
import { HomeSkeleton } from "../components/Skeletons";
import { IconPlus, IconTrash } from "../components/icons";
import { AnimatedNumber, DogAvatar, Glass, Page, rise, spring, stagger, useToast } from "../components/ui";
import { useCurrentDog } from "../dogContext";
import { TYPES, ageText, dayLabel, fmtTime, recordTitle, typeMeta } from "../meta";

export default function Home({ onAdd }: { onAdd: (t?: RecordType) => void }) {
  const { dogs, dog, setDogId } = useCurrentDog();
  const records = useRecords(dog?.id);
  const stats = useStats(dog?.id);

  const groups = useMemo(() => {
    const m = new Map<string, Rec[]>();
    for (const r of records.data ?? []) {
      const k = new Date(r.at).toDateString();
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    return [...m.values()];
  }, [records.data]);

  if (!dog || records.isPending || stats.isPending) return <HomeSkeleton />;

  const t = stats.data?.today;
  const age = ageText(dog.birthday);

  return (
    <Page>
      <header className="flex items-end justify-between py-2">
        <div>
          <motion.h1 layoutId={`dog-name-${dog.id}`} className="text-3xl font-black" data-testid="dog-name">
            {dog.name}
          </motion.h1>
          <p className="mt-0.5 text-sm font-bold opacity-60">{[dog.breed, age].filter(Boolean).join("・")}</p>
        </div>
        <DogAvatar dog={dog} size={52} className="ring-2 ring-white/60" />
      </header>

      {/* dog switcher */}
      {dogs.length > 0 && (
        <div className="no-scrollbar -mx-4 mt-3 flex gap-3 overflow-x-auto px-4 py-1">
          {dogs.map((d) => (
            <motion.button
              key={d.id}
              whileTap={{ scale: 0.9 }}
              onClick={() => setDogId(d.id)}
              aria-label={`${d.name}に切り替え`}
              aria-current={d.id === dog.id}
              className="relative flex shrink-0 flex-col items-center gap-1"
            >
              {d.id === dog.id && (
                <motion.span layoutId="dog-ring" className="absolute -left-1 -top-1 h-16 w-16 rounded-full ring-[3px] ring-[var(--accent)]" transition={spring} />
              )}
              <DogAvatar dog={d} size={56} />
              <span className="text-[11px] font-bold opacity-70">{d.name}</span>
            </motion.button>
          ))}
          <Link to="/dogs/new" aria-label="わんこを追加" className="flex shrink-0 flex-col items-center gap-1">
            <span className="glass grid h-14 w-14 place-items-center rounded-full opacity-80">
              <IconPlus size={22} />
            </span>
          </Link>
        </div>
      )}

      {/* today */}
      <motion.section variants={stagger} initial="hidden" animate="show" className="mt-5">
        <Glass variants={rise} className="relative overflow-hidden rounded-[30px] p-5">
          <p className="text-xs font-bold opacity-60">今日の散歩</p>
          <div className="mt-1 flex items-baseline gap-1" data-testid="today-walk">
            <span className="text-5xl font-black tabular-nums">
              <AnimatedNumber value={t?.walkMin ?? 0} />
            </span>
            <span className="text-lg font-bold opacity-60">分</span>
            <span className="ml-auto text-sm font-bold opacity-60">{t?.walk ?? 0}回</span>
          </div>
          <WalkBar minutes={t?.walkMin ?? 0} />
        </Glass>

        <div className="mt-3 grid grid-cols-3 gap-3">
          <Mini label="ごはん" color="var(--meal)" value={t?.meal ?? 0} unit="回" testid="today-meal" />
          <Mini label="トイレ" color="var(--toilet)" value={t?.toilet ?? 0} unit="回" testid="today-toilet" />
          <Mini
            label="体重"
            color="var(--weight)"
            value={stats.data?.lastWeight?.value ?? 0}
            decimals={1}
            unit="kg"
            empty={!stats.data?.lastWeight}
            testid="today-weight"
          />
        </div>
      </motion.section>

      {/* quick types */}
      <div className="no-scrollbar -mx-4 mt-5 flex gap-2 overflow-x-auto px-4">
        {TYPES.map((x, i) => (
          <motion.button
            key={x.type}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.04, ...spring }}
            whileTap={{ scale: 0.92 }}
            onClick={() => onAdd(x.type)}
            data-testid={`quick-${x.type}`}
            className="glass flex shrink-0 items-center gap-1.5 rounded-full py-2 pl-2.5 pr-4 text-sm font-bold"
          >
            <span className="grid h-7 w-7 place-items-center rounded-full text-white" style={{ background: x.color }}>
              {x.icon(16)}
            </span>
            {x.label}
          </motion.button>
        ))}
      </div>

      {/* timeline */}
      <section className="mt-7" aria-label="記録">
        {groups.length === 0 ? (
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="glass rounded-[28px] p-8 text-center">
            <motion.div animate={{ rotate: [0, -8, 8, 0] }} transition={{ repeat: Infinity, duration: 2.4 }} className="mx-auto w-fit text-[var(--accent)]">
              {typeMeta("walk").icon(40)}
            </motion.div>
            <p className="mt-3 text-sm font-bold opacity-60">記録はまだありません</p>
          </motion.div>
        ) : (
          groups.map((g) => (
            <div key={g[0].at.slice(0, 10) + g[0].id} className="mb-6">
              <h2 className="mb-2 px-1 text-sm font-black opacity-60">{dayLabel(g[0].at)}</h2>
              <motion.ul layout className="space-y-2">
                <AnimatePresence initial={true}>
                  {g.map((r, i) => (
                    <RecordRow key={r.id} r={r} index={i} dogId={dog.id} />
                  ))}
                </AnimatePresence>
              </motion.ul>
            </div>
          ))
        )}
      </section>
    </Page>
  );
}

function WalkBar({ minutes }: { minutes: number }) {
  const goal = 60;
  return (
    <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
      <motion.div
        className="h-full rounded-full"
        style={{ background: "linear-gradient(90deg, var(--walk), color-mix(in oklab, var(--walk) 60%, white))" }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, (minutes / goal) * 100)}%` }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
      />
    </div>
  );
}

function Mini(p: { label: string; color: string; value: number; unit: string; decimals?: number; empty?: boolean; testid: string }) {
  return (
    <Glass variants={rise} className="rounded-[24px] p-3.5">
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
        <span className="text-[11px] font-bold opacity-60">{p.label}</span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-0.5" data-testid={p.testid}>
        <span className="text-2xl font-black tabular-nums">{p.empty ? "—" : <AnimatedNumber value={p.value} decimals={p.decimals} />}</span>
        {!p.empty && <span className="text-xs font-bold opacity-60">{p.unit}</span>}
      </div>
    </Glass>
  );
}

function RecordRow({ r, index, dogId }: { r: Rec; index: number; dogId: string }) {
  const m = typeMeta(r.type);
  const del = useDeleteRecord(dogId);
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const x = useMotionValue(0);
  const delOpacity = useTransform(x, [-100, -8, 0], [1, 0.4, 0]);
  const remove = () => {
    del.mutate(r.id);
    toast("削除しました");
  };
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1, transition: { ...spring, delay: Math.min(index, 8) * 0.04 } }}
      exit={{ opacity: 0, x: -80, height: 0, marginTop: 0, transition: { duration: 0.25 } }}
      className="relative"
      data-testid="record-item"
    >
      <motion.div
        aria-hidden
        className="absolute inset-0 flex items-center justify-end rounded-[22px] pr-5 text-white"
        style={{ background: "var(--health)", opacity: delOpacity }}
      >
        <IconTrash size={20} />
      </motion.div>
      <motion.div
        drag="x"
        style={{ x }}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0.5, right: 0 }}
        onDragEnd={(_, i) => i.offset.x < -110 && remove()}
        onClick={() => setOpen((o) => !o)}
        className="glass glass-strong relative cursor-pointer rounded-[22px] p-3"
      >
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white" style={{ background: m.color }}>
            {m.icon(22)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold">{recordTitle(r)}</p>
            {r.note && <p className={`text-sm opacity-60 ${open ? "" : "truncate"}`}>{r.note}</p>}
          </div>
          <time className="shrink-0 text-xs font-bold tabular-nums opacity-50">{fmtTime(r.at)}</time>
        </div>
        {r.photo_key && (
          <motion.img
            layout
            src={photoUrl(r.photo_key)!}
            alt={r.note ?? m.label}
            loading="lazy"
            className={`mt-3 w-full rounded-2xl object-cover ${open ? "max-h-[70vh]" : "aspect-[16/9]"}`}
          />
        )}
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  remove();
                }}
                className="mt-3 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold"
                style={{ color: "var(--health)", background: "color-mix(in oklab, var(--health) 12%, transparent)" }}
              >
                <IconTrash size={16} />
                削除
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.li>
  );
}

