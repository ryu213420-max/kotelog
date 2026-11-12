import type { ReactNode } from "react";
import type { Rec, RecordType } from "./api";
import { IconDiary, IconHealth, IconMeal, IconToilet, IconWalk, IconWeight } from "./components/icons";

export const TYPES: {
  type: RecordType;
  label: string;
  color: string;
  icon: (size?: number) => ReactNode;
  unit?: string;
  tags?: string[];
  valueLabel?: string;
  step?: number;
}[] = [
  { type: "walk", label: "散歩", color: "var(--walk)", icon: (s) => <IconWalk size={s} />, unit: "分", valueLabel: "時間", step: 5 },
  { type: "meal", label: "ごはん", color: "var(--meal)", icon: (s) => <IconMeal size={s} />, unit: "g", valueLabel: "量", tags: ["朝", "昼", "夜", "おやつ"], step: 10 },
  { type: "weight", label: "体重", color: "var(--weight)", icon: (s) => <IconWeight size={s} />, unit: "kg", valueLabel: "体重", step: 0.1 },
  { type: "toilet", label: "トイレ", color: "var(--toilet)", icon: (s) => <IconToilet size={s} />, tags: ["おしっこ", "うんち"] },
  { type: "health", label: "健康", color: "var(--health)", icon: (s) => <IconHealth size={s} />, tags: ["通院", "投薬", "ワクチン", "体調"] },
  { type: "diary", label: "日記", color: "var(--diary)", icon: (s) => <IconDiary size={s} /> },
];

export const typeMeta = (t: RecordType) => TYPES.find((x) => x.type === t)!;

export function recordTitle(r: Rec) {
  const m = typeMeta(r.type);
  const parts = [r.tag, r.value != null && m.unit ? `${fmtNum(r.value)}${m.unit}` : null].filter(Boolean);
  return parts.length ? `${m.label}・${parts.join(" ")}` : m.label;
}

export const fmtNum = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });

export function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date(Date.now() - 86400_000);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return "今日";
  if (same(d, y)) return "昨日";
  return d.toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" });
}

export function ageText(birthday: string | null) {
  if (!birthday) return null;
  const b = new Date(birthday);
  const now = new Date();
  let months = (now.getFullYear() - b.getFullYear()) * 12 + now.getMonth() - b.getMonth();
  if (now.getDate() < b.getDate()) months--;
  if (months < 0) return null;
  return months < 12 ? `${months}ヶ月` : `${Math.floor(months / 12)}歳${months % 12 ? `${months % 12}ヶ月` : ""}`;
}

/** datetime-local 用のローカル時刻文字列 */
export const toLocalInput = (d = new Date()) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
