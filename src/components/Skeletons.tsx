import { motion } from "motion/react";

const Sk = ({ className = "", style }: { className?: string; style?: React.CSSProperties }) => <div className={`sk ${className}`} style={style} />;

function Shell({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <motion.div
      role="status"
      aria-busy="true"
      aria-label={label}
      data-testid="skeleton"
      className="relative z-10 mx-auto min-h-dvh max-w-lg px-4 pb-36 safe-top"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {children}
    </motion.div>
  );
}

function TabBarSk() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-lg justify-center px-4 safe-bottom">
      <Sk className="h-[68px] w-full !rounded-[34px]" />
    </div>
  );
}

export function HomeSkeleton() {
  return (
    <Shell label="読み込み中">
      <div className="flex items-center justify-between py-2">
        <Sk className="h-8 w-28" />
        <Sk className="h-10 w-10 !rounded-full" />
      </div>
      <div className="mt-4 flex gap-3">
        {[0, 1, 2].map((i) => (
          <Sk key={i} className="h-16 w-16 !rounded-full" />
        ))}
      </div>
      <Sk className="mt-6 h-36 !rounded-[28px]" />
      <div className="mt-4 grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <Sk key={i} className="h-24 !rounded-[22px]" />
        ))}
      </div>
      <Sk className="mt-6 h-14 !rounded-[22px]" />
      <Sk className="mt-8 h-5 w-16" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="mt-3 flex items-center gap-3">
          <Sk className="h-12 w-12 !rounded-2xl" />
          <div className="flex-1 space-y-2">
            <Sk className="h-4 w-2/3" />
            <Sk className="h-3 w-1/3" />
          </div>
        </div>
      ))}
      <TabBarSk />
    </Shell>
  );
}

export function StatsSkeleton() {
  return (
    <Shell label="読み込み中">
      <Sk className="mt-2 h-8 w-24" />
      <Sk className="mt-6 h-64 !rounded-[28px]" />
      <Sk className="mt-4 h-52 !rounded-[28px]" />
      <Sk className="mt-4 h-40 !rounded-[28px]" />
      <TabBarSk />
    </Shell>
  );
}

export function AlbumSkeleton() {
  return (
    <Shell label="読み込み中">
      <Sk className="mt-2 h-8 w-28" />
      <div className="mt-6 grid grid-cols-3 gap-1.5">
        {Array.from({ length: 15 }).map((_, i) => (
          <Sk key={i} className="aspect-square !rounded-xl" />
        ))}
      </div>
      <TabBarSk />
    </Shell>
  );
}

export function SettingsSkeleton() {
  return (
    <Shell label="読み込み中">
      <Sk className="mt-2 h-8 w-20" />
      <Sk className="mt-6 h-24 !rounded-[28px]" />
      <Sk className="mt-6 h-5 w-16" />
      {[0, 1].map((i) => (
        <Sk key={i} className="mt-3 h-20 !rounded-[24px]" />
      ))}
      <Sk className="mt-8 h-14 !rounded-[22px]" />
      <TabBarSk />
    </Shell>
  );
}

export function FormSkeleton() {
  return (
    <Shell label="読み込み中">
      <Sk className="mt-2 h-10 w-10 !rounded-full" />
      <Sk className="mx-auto mt-6 h-28 w-28 !rounded-full" />
      {[0, 1, 2, 3].map((i) => (
        <Sk key={i} className="mt-5 h-12 !rounded-2xl" />
      ))}
      <Sk className="mt-8 h-14 !rounded-[22px]" />
    </Shell>
  );
}

export function LoginSkeleton() {
  return (
    <Shell label="読み込み中">
      <div className="flex min-h-[80dvh] flex-col items-center justify-center gap-5">
        <Sk className="h-28 w-28 !rounded-[32px]" />
        <Sk className="h-8 w-32" />
        <Sk className="mt-10 h-14 w-full max-w-xs !rounded-full" />
      </div>
    </Shell>
  );
}
