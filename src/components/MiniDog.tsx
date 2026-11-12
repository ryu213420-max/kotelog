import { motion } from "motion/react";
import { useEffect, useState } from "react";

export type DogMood = "idle" | "happy" | "think" | "sleep";

const BLACK = "#241711";
const TAN = "#c4874a";
const TAN_DARK = "#a86d36";

/** ちっちゃいブラックタンのダックス（右向き） */
export function MiniDog({ mood = "idle", size = 72 }: { mood?: DogMood; size?: number }) {
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    if (mood === "sleep") return;
    let t: ReturnType<typeof setTimeout>;
    const loop = () => {
      t = setTimeout(() => {
        setBlink(true);
        setTimeout(() => setBlink(false), 140);
        loop();
      }, 2200 + Math.random() * 2600);
    };
    loop();
    return () => clearTimeout(t);
  }, [mood]);

  const wagSpeed = mood === "happy" ? 0.18 : mood === "think" ? 0.9 : 0.5;
  const eyesClosed = blink || mood === "sleep";

  return (
    <motion.svg
      width={size}
      height={size * 0.78}
      viewBox="0 0 120 94"
      aria-hidden
      animate={
        mood === "happy"
          ? { y: [0, -14, 0, -8, 0], rotate: [0, -4, 0, 3, 0] }
          : mood === "sleep"
            ? { y: 0, scaleY: [1, 0.97, 1] }
            : { y: [0, -1.5, 0] }
      }
      transition={
        mood === "happy"
          ? { duration: 0.8, ease: "easeOut" }
          : { duration: mood === "sleep" ? 3 : 2.2, repeat: Infinity, ease: "easeInOut" }
      }
      style={{ overflow: "visible", transformOrigin: "50% 100%" }}
    >
      {/* shadow */}
      <ellipse cx="58" cy="88" rx="40" ry="4" fill="#000" opacity="0.15" />
      {/* tail */}
      <motion.path
        d="M24 50 Q10 40 12 26"
        stroke={BLACK}
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
        style={{ originX: "24px", originY: "50px" }}
        animate={mood === "sleep" ? { rotate: 20 } : { rotate: [-14, 18, -14] }}
        transition={mood === "sleep" ? {} : { duration: wagSpeed, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* back legs */}
      <rect x="28" y="62" width="9" height="18" rx="4.5" fill={TAN_DARK} />
      <rect x="40" y="64" width="9" height="17" rx="4.5" fill={TAN} />
      {/* front legs */}
      <rect x="70" y="64" width="9" height="17" rx="4.5" fill={TAN_DARK} />
      <rect x="82" y="62" width="9" height="18" rx="4.5" fill={TAN} />
      {/* body */}
      <ellipse cx="57" cy="55" rx="36" ry="16" fill={BLACK} />
      <ellipse cx="84" cy="62" rx="9" ry="7" fill={TAN} />
      {/* head */}
      <motion.g
        style={{ originX: "88px", originY: "44px" }}
        animate={mood === "think" ? { rotate: [0, -10, -10, 0] } : mood === "sleep" ? { rotate: 12, y: 8 } : { rotate: [0, 2, 0] }}
        transition={mood === "think" ? { duration: 1.6, repeat: Infinity } : mood === "sleep" ? {} : { duration: 3.2, repeat: Infinity }}
      >
        <circle cx="90" cy="36" r="18" fill={BLACK} />
        <ellipse cx="103" cy="45" rx="12" ry="8" fill={TAN} />
        <ellipse cx="113" cy="42" rx="4" ry="3.4" fill="#0d0806" />
        <path d="M104 50 q3 2 6 0" stroke="#0d0806" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        {mood === "happy" && <path d="M106 51 q2 6 5 0z" fill="#e86b6b" />}
        {/* eyebrows */}
        <circle cx="87" cy="26" r="2.6" fill={TAN} />
        <circle cx="98" cy="26.5" r="2.4" fill={TAN} />
        {/* eyes */}
        {eyesClosed ? (
          <>
            <path d="M85 33 q2.6 2 5.2 0" stroke="#f3e2cc" strokeWidth="1.6" fill="none" strokeLinecap="round" />
            <path d="M96 33.4 q2.4 1.8 4.8 0" stroke="#f3e2cc" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          </>
        ) : (
          <>
            <circle cx="87.6" cy="32.5" r="3.2" fill="#3b2216" />
            <circle cx="98.4" cy="33" r="3" fill="#3b2216" />
            <circle cx="88.6" cy="31.4" r="1.1" fill="#fff" />
            <circle cx="99.3" cy="31.9" r="1" fill="#fff" />
          </>
        )}
        {/* ear */}
        <motion.ellipse
          cx="79"
          cy="42"
          rx="7.5"
          ry="14"
          fill="#1a100b"
          style={{ originX: "80px", originY: "30px" }}
          animate={mood === "happy" ? { rotate: [10, -18, 10] } : { rotate: [10, 4, 10] }}
          transition={{ duration: mood === "happy" ? 0.35 : 2.6, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.g>
      {mood === "sleep" && (
        <motion.text
          x="104"
          y="16"
          fontSize="12"
          fontWeight="900"
          fill="currentColor"
          animate={{ opacity: [0, 1, 0], y: [16, 4, -6] }}
          transition={{ duration: 2.4, repeat: Infinity }}
        >
          z
        </motion.text>
      )}
    </motion.svg>
  );
}
