import type { StatId } from "./api";

const int = new Intl.NumberFormat("en-US");

export const n = (v: number) => int.format(Math.round(v));
export const pct = (v: number, digits = 1) => `${v.toFixed(digits)}%`;

export function statValue(stat: StatId, value: number): string {
  return stat === "ratio" ? pct(value) : n(value);
}

/** "in 1 day, 6 hours" style countdown to a weekly reset. */
export function untilText(iso: string, now = Date.now()): string {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return "any moment now";
  const hours = Math.floor(ms / 3_600_000);
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  if (days > 0) return `in ${days} day${days === 1 ? "" : "s"}${rest ? `, ${rest} hour${rest === 1 ? "" : "s"}` : ""}`;
  if (hours > 0) return `in ${hours} hour${hours === 1 ? "" : "s"}`;
  return `in ${Math.max(1, Math.round(ms / 60_000))} minutes`;
}

export function agoText(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  return `${Math.round(m / 60)} h ago`;
}

export const STAT_COPY: Record<StatId, { title: string; unit: string }> = {
  presses: { title: "Most presses", unit: "presses" },
  events: { title: "Most events survived", unit: "survived" },
  streak: { title: "Longest streak", unit: "streak" },
  ratio: { title: "Best survival ratio", unit: "survived" },
};
