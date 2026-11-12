import { motion } from "motion/react";
import { useSearchParams } from "react-router";
import { GoogleLogo } from "../components/icons";
import { Page, spring } from "../components/ui";

const ERR: Record<string, string> = {
  state: "ログインをやり直してください",
  token: "Google 認証に失敗しました",
  userinfo: "Google 認証に失敗しました",
  email: "メールアドレスが未確認です",
};

export default function Login() {
  const [params] = useSearchParams();
  const err = params.get("error");
  return (
    <Page className="flex flex-col items-center justify-center !pb-10">
      <div className="flex min-h-[86dvh] w-full flex-col items-center justify-center">
        <motion.div
          initial={{ scale: 0.4, rotate: -20, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ ...spring, delay: 0.05 }}
          className="glass glass-refract grid h-28 w-28 place-items-center rounded-[34px]"
        >
          <motion.img
            src="/icon.svg"
            alt=""
            className="h-20 w-20 rounded-[24px]"
            animate={{ y: [0, -4, 0] }}
            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
          />
        </motion.div>
        <motion.h1
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15, ...spring }}
          className="mt-5 text-3xl font-black tracking-wide"
        >
          わんログ
        </motion.h1>

        {err && (
          <motion.p role="alert" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 text-sm font-bold text-[var(--health)]">
            {ERR[err] ?? "ログインできませんでした"}
          </motion.p>
        )}

        <motion.a
          href="/auth/google"
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, ...spring }}
          whileTap={{ scale: 0.95 }}
          className="glass glass-strong mt-14 flex h-14 w-full max-w-xs items-center justify-center gap-3 rounded-full text-base font-bold"
        >
          <GoogleLogo />
          Google でログイン
        </motion.a>
      </div>
    </Page>
  );
}
