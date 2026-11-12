import { useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Link } from "react-router";
import { api, useMe } from "../api";
import { SettingsSkeleton } from "../components/Skeletons";
import { IconLogout, IconPlus } from "../components/icons";
import { DogAvatar, Glass, Page, PressButton, rise, stagger } from "../components/ui";
import { useCurrentDog } from "../dogContext";
import { ageText } from "../meta";

export default function Settings() {
  const me = useMe();
  const { dogs, loading } = useCurrentDog();
  const qc = useQueryClient();
  if (!me.data || loading) return <SettingsSkeleton />;

  const logout = async () => {
    await api("/auth/logout", { method: "POST" });
    qc.clear();
    location.href = "/login";
  };

  return (
    <Page>
      <h1 className="py-2 text-3xl font-black">設定</h1>
      <motion.div variants={stagger} initial="hidden" animate="show">
        <Glass variants={rise} className="mt-4 flex items-center gap-4 rounded-[28px] p-4">
          {me.data.avatar ? (
            <img src={me.data.avatar} alt="" referrerPolicy="no-referrer" className="h-14 w-14 rounded-full" />
          ) : (
            <DogAvatar dog={{ name: me.data.name, photo_key: null }} size={56} />
          )}
          <div className="min-w-0">
            <p className="truncate font-black" data-testid="user-name">
              {me.data.name}
            </p>
            <p className="truncate text-sm opacity-60">{me.data.email}</p>
          </div>
        </Glass>

        <motion.h2 variants={rise} className="mb-2 mt-7 px-1 text-sm font-black opacity-60">
          わんこ
        </motion.h2>
        <div className="space-y-2.5">
          {dogs.map((d) => (
            <motion.div key={d.id} variants={rise}>
              <Link to={`/dogs/${d.id}`} className="glass flex items-center gap-3 rounded-[24px] p-3" data-testid="dog-row">
                <DogAvatar dog={d} size={48} />
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{d.name}</p>
                  <p className="text-xs opacity-60">{[d.breed, ageText(d.birthday)].filter(Boolean).join("・") || "—"}</p>
                </div>
                <span className="text-xl opacity-40">›</span>
              </Link>
            </motion.div>
          ))}
          <motion.div variants={rise}>
            <Link to="/dogs/new" className="flex items-center justify-center gap-2 rounded-[24px] border-2 border-dashed border-current/20 py-4 text-sm font-bold opacity-70">
              <IconPlus size={18} />
              わんこを追加
            </Link>
          </motion.div>
        </div>

        <motion.div variants={rise}>
          <PressButton onClick={logout} className="glass mt-10 flex h-14 w-full items-center justify-center gap-2 rounded-[22px] font-bold" data-testid="logout">
            <IconLogout size={20} />
            ログアウト
          </PressButton>
        </motion.div>
      </motion.div>
    </Page>
  );
}
