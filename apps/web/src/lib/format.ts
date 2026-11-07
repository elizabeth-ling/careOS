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

/** 19 → "7 PM". */
export function formatHour(hour: number): string {
  return new Date(2000, 0, 1, hour).toLocaleTimeString("en-US", { hour: "numeric" });
}
