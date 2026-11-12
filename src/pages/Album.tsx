import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { photoUrl, useRecords, type Rec } from "../api";
import { AlbumSkeleton } from "../components/Skeletons";
import { IconCamera, IconClose } from "../components/icons";
import { Page, softSpring } from "../components/ui";
import { useCurrentDog } from "../dogContext";
import { dayLabel, fmtTime, recordTitle } from "../meta";

export default function Album({ onAdd }: { onAdd: () => void }) {
  const { dog } = useCurrentDog();
  const photos = useRecords(dog?.id, true);
  const [sel, setSel] = useState<Rec | null>(null);
  if (!dog || photos.isPending) return <AlbumSkeleton />;
  const list = photos.data ?? [];
  return (
    <Page>
      <h1 className="py-2 text-3xl font-black">アルバム</h1>
      {list.length === 0 ? (
        <motion.button
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          whileTap={{ scale: 0.97 }}
          onClick={onAdd}
          className="glass mt-6 flex w-full flex-col items-center gap-3 rounded-[28px] py-12 font-bold opacity-80"
        >
          <IconCamera size={36} />
          <span className="text-sm">写真を追加</span>
        </motion.button>
      ) : (
        <div className="mt-4 grid grid-cols-3 gap-1.5" data-testid="album-grid">
          {list.map((r, i) => (
            <motion.button
              key={r.id}
              layoutId={`photo-${r.id}`}
              onClick={() => setSel(r)}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ ...softSpring, delay: Math.min(i, 18) * 0.03 }}
              className="aspect-square overflow-hidden rounded-xl"
            >
              <img src={photoUrl(r.photo_key)!} alt={r.note ?? ""} loading="lazy" className="h-full w-full object-cover" />
            </motion.button>
          ))}
        </div>
      )}

      <AnimatePresence>
        {sel && (
          <motion.div
            className="fixed inset-0 z-50 flex flex-col justify-center bg-black/70 p-4 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSel(null)}
            role="dialog"
            aria-label="写真"
          >
            <button aria-label="閉じる" className="glass absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full text-white safe-top">
              <IconClose size={20} />
            </button>
            <motion.img
              layoutId={`photo-${sel.id}`}
              src={photoUrl(sel.photo_key)!}
              alt={sel.note ?? ""}
              className="mx-auto max-h-[70dvh] w-full max-w-lg rounded-3xl object-contain"
              transition={softSpring}
            />
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1, transition: { delay: 0.15 } }}
              exit={{ opacity: 0 }}
              className="mx-auto mt-4 w-full max-w-lg text-white"
            >
              <p className="text-xs font-bold opacity-70">
                {dayLabel(sel.at)} {fmtTime(sel.at)}・{recordTitle(sel)}
              </p>
              {sel.note && <p className="mt-1 font-bold leading-relaxed">{sel.note}</p>}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Page>
  );
}
