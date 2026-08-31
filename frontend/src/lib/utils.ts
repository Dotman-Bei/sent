import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shortAddress(address?: string | null, size = 4) {
  if (!address) return "";
  return `${address.slice(0, 2 + size)}…${address.slice(-size)}`;
}

export function shortHash(hash?: string | null) {
  if (!hash) return "";
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

/** Compact number formatting for metric tiles: 1.2K, 3.4M. */
export function compact(value: number | bigint) {
  const n = typeof value === "bigint" ? Number(value) : value;
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function formatNumber(value: number | bigint) {
  return new Intl.NumberFormat("en").format(value as number);
}

/** "3m ago", "2h ago", halt records are read as unix seconds. */
export function timeAgo(unixSeconds: number | bigint) {
  const seconds = Math.max(0, Math.floor(Date.now() / 1000) - Number(unixSeconds));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

/** Seconds remaining until a deadline, as a human string. */
export function timeUntil(unixSeconds: number | bigint) {
  const seconds = Number(unixSeconds) - Math.floor(Date.now() / 1000);
  if (seconds <= 0) return "expired";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

export const pct = (used: number, ceiling: number) =>
  ceiling <= 0 ? 0 : Math.min(100, (used / ceiling) * 100);
