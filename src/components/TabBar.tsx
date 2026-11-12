import { motion } from "motion/react";
import { NavLink, useLocation } from "react-router";
import { IconAlbum, IconChart, IconGear, IconHome, IconPlus } from "./icons";
import { spring } from "./ui";

const TABS = [
  { to: "/", label: "ホーム", icon: IconHome },
  { to: "/stats", label: "グラフ", icon: IconChart },
  null,
  { to: "/album", label: "アルバム", icon: IconAlbum },
  { to: "/settings", label: "設定", icon: IconGear },
] as const;

export function TabBar({ onAdd }: { onAdd: () => void }) {
  const { pathname } = useLocation();
  return (
    <motion.nav
      aria-label="メイン"
      className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-lg px-4 safe-bottom"
      initial={{ y: 120 }}
      animate={{ y: 0 }}
      transition={{ ...spring, delay: 0.1 }}
    >
      <div className="glass glass-refract relative flex h-[68px] items-center justify-around rounded-[34px] px-2">
        {TABS.map((t) =>
          t === null ? (
            <motion.button
              key="add"
              aria-label="記録する"
              data-testid="add-button"
              onClick={onAdd}
              whileTap={{ scale: 0.88, rotate: 90 }}
              whileHover={{ scale: 1.06 }}
              transition={spring}
              className="btn-accent -mt-8 grid h-16 w-16 place-items-center rounded-full"
            >
              <IconPlus size={28} strokeWidth={2.4} />
            </motion.button>
          ) : (
            <NavLink
              key={t.to}
              to={t.to}
              aria-label={t.label}
              className="relative grid h-14 w-14 place-items-center rounded-full"
            >
              {pathname === t.to && (
                <motion.span
                  layoutId="tab-pill"
                  className="absolute inset-1 rounded-full"
                  style={{ background: "color-mix(in oklab, var(--accent) 22%, transparent)" }}
                  transition={spring}
                />
              )}
              <motion.span
                className="relative flex flex-col items-center gap-0.5"
                animate={{ color: pathname === t.to ? "var(--accent)" : "var(--ink-soft)", y: pathname === t.to ? -1 : 0 }}
              >
                <t.icon size={23} />
                <span className="text-[10px] font-bold leading-none">{t.label}</span>
              </motion.span>
            </NavLink>
          ),
        )}
      </div>
    </motion.nav>
  );
}
