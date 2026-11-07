/** "Priya Sharma" → "PS". */
export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

export function firstNameOf(name: string): string {
  return name.split(/\s+/)[0] ?? name;
}

/** "Walter Morrison" → "Walter M." */
export function shortNameOf(name: string): string {
  const [first, ...rest] = name.split(/\s+/).filter(Boolean);
  const last = rest.at(-1);
  return last ? `${first} ${last[0]!.toUpperCase()}.` : (first ?? name);
}

/** ["A", "B", "C"] → "A, B and C". */
export function joinWithAnd(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/** 19 → "7 PM". */
export function formatHour(hour: number): string {
  return new Date(2000, 0, 1, hour).toLocaleTimeString("en-US", { hour: "numeric" });
}

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Whole calendar days between two dates, in local time. */
function daysBetween(earlier: Date, later: Date): number {
  return Math.round((startOfDay(later) - startOfDay(earlier)) / DAY_MS);
}

/** "Just now", "12 min ago", "2 hours ago", "Yesterday", "3 days ago", "Oct 28". */
export function formatRelative(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const days = daysBetween(date, now);
  if (days <= 0) {
    const hours = Math.floor(minutes / 60);
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** "Today, 1:43 PM", "Yesterday, 9:05 AM", "Nov 4, 3:15 PM". */
export function formatDayTime(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const days = daysBetween(date, now);
  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Yesterday, ${time}`;
  return `${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${time}`;
}

/** "Saturday, November 7". */
export function formatLongDate(date = new Date()): string {
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

/** "2026-10-17" (a calendar date, no time) → "Oct 17". */
export function formatShortDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year!, month! - 1, day!).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** 48 → "0:48". */
export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;
}

/** 3 → "3.0h". */
export function formatHours(hours: number | null): string {
  return hours === null ? "–" : `${hours.toFixed(1)}h`;
}

/** "Good morning" before noon, "Good afternoon" until 6 PM, then "Good evening". */
export function greetingFor(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** "today at 1:43 PM", "yesterday at 9:05 AM", "Nov 4 at 3:15 PM". */
export function formatDayAt(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const days = daysBetween(date, now);
  if (days === 0) return `today at ${time}`;
  if (days === 1) return `yesterday at ${time}`;
  return `${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} at ${time}`;
}

/** "Mon Nov 9 at 10:00 AM". */
export function formatWeekdayAt(iso: string): string {
  const date = new Date(iso);
  const day = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${day.replace(",", "")} at ${time}`;
}

/** 83 → "1:23", for a live recording timer (always mm:ss). */
export function formatTimer(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(whole / 60)).padStart(2, "0")}:${String(whole % 60).padStart(2, "0")}`;
}
