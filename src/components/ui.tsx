import { AnimatePresence, animate, motion, useMotionValue, useTransform, type HTMLMotionProps } from "motion/react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { photoUrl, type Dog } from "../api";
import { IconClose } from "./icons";
import { MiniDog } from "./MiniDog";

export const spring = { type: "spring" as const, stiffness: 420, damping: 32 };
export const softSpring = { type: "spring" as const, stiffness: 260, damping: 26 };

/** SVG フィルタ（液体ガラスの屈折）と背景のブロブ */
export function Backdrop() {
  return (
    <>
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
        <filter id="liquid" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.008 0.012" numOctaves="2" seed="7" result="noise" />
          <feGaussianBlur in="noise" stdDeviation="2" result="soft" />
          <feDisplacementMap in="SourceGraphic" in2="soft" scale="38" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      <div className="backdrop" aria-hidden>
        <span />
        <span />
        <span />
        <span />
      </div>
    </>
  );
}

export function Glass({ className = "", strong, ...p }: HTMLMotionProps<"div"> & { strong?: boolean }) {
  return <motion.div className={`glass ${strong ? "glass-strong" : ""} ${className}`} {...p} />;
}

export function PressButton({ className = "", ...p }: HTMLMotionProps<"button">) {
  return <motion.button whileTap={{ scale: 0.94 }} transition={spring} className={className} {...p} />;
}

export function DogAvatar({ dog, size = 44, className = "" }: { dog?: Pick<Dog, "name" | "photo_key"> | null; size?: number; className?: string }) {
  const url = photoUrl(dog?.photo_key ?? null);
  return (
    <div
      className={`shrink-0 overflow-hidden rounded-full grid place-items-center font-bold text-white ${className}`}
      style={{ width: size, height: size, background: "linear-gradient(140deg, var(--color-cocoa-300), var(--color-cocoa-600))", fontSize: size * 0.42 }}
    >
      {url ? (
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="translate-x-[-6%] translate-y-[6%]">
          <MiniDog size={size * 0.95} />
        </span>
      )}
    </div>
  );
}

export function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => v.toFixed(decimals));
  useEffect(() => {
    const c = animate(mv, value, { duration: 0.9, ease: [0.16, 1, 0.3, 1] });
    return c.stop;
  }, [value, mv]);
  return <motion.span>{text}</motion.span>;
}

/** ボトムシート（ドラッグで閉じられる） */
export function Sheet({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: ReactNode; label: string }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal
            aria-label={label}
            className="glass glass-strong fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[92dvh] max-w-lg overflow-y-auto rounded-t-[32px] px-5 pt-3 safe-bottom no-scrollbar"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={softSpring}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, i) => (i.offset.y > 120 || i.velocity.y > 600) && onClose()}
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-current opacity-20" />
            <button aria-label="閉じる" onClick={onClose} className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full opacity-60">
              <IconClose size={20} />
            </button>
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ---------- toast ---------- */
const ToastCtx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; msg: string }[]>([]);
  const id = useRef(0);
  const push = useCallback((msg: string) => {
    const n = ++id.current;
    setItems((x) => [...x, { id: n, msg }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== n)), 2200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 safe-top">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div
              key={t.id}
              role="status"
              layout
              initial={{ y: -40, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -20, opacity: 0, scale: 0.95 }}
              transition={spring}
              className="glass glass-strong rounded-full px-5 py-2.5 text-sm font-bold"
            >
              {t.msg}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

/** ページ遷移ラッパ */
export function Page({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <motion.main
      className={`relative z-10 mx-auto min-h-dvh max-w-lg px-4 pb-36 safe-top ${className}`}
      initial={{ opacity: 0, y: 18, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
      transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.main>
  );
}

export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};
export const rise = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: softSpring },
};
