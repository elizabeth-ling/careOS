import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";
import {
  formatDayAt,
  formatDayTime,
  formatDuration,
  formatHours,
  formatRelative,
  formatTimer,
  formatWeekdayAt,
  greetingFor,
  joinWithAnd,
  shortNameOf,
} from "./format";

const now = new Date(2026, 10, 7, 14, 0);
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();

describe("format", () => {
  it("shortens names for the stat cards", () => {
    expect(shortNameOf("Walter Morrison")).toBe("Walter M.");
    expect(shortNameOf("Cher")).toBe("Cher");
    expect(joinWithAnd(["Walter M.", "Margaret O."])).toBe("Walter M. and Margaret O.");
    expect(joinWithAnd(["A", "B", "C"])).toBe("A, B and C");
  });

  it("describes how long ago a check-in came in", () => {
    expect(formatRelative(minutesAgo(0), now)).toBe("Just now");
    expect(formatRelative(minutesAgo(12), now)).toBe("12 min ago");
    expect(formatRelative(minutesAgo(120), now)).toBe("2 hours ago");
    expect(formatRelative(minutesAgo(60 * 24), now)).toBe("Yesterday");
    expect(formatRelative(minutesAgo(60 * 24 * 3), now)).toBe("3 days ago");
  });

  it("formats check-in times and durations", () => {
    expect(formatDayTime(new Date(2026, 10, 7, 13, 43).toISOString(), now)).toBe("Today, 1:43 PM");
    expect(formatDayTime(new Date(2026, 10, 6, 9, 5).toISOString(), now)).toBe("Yesterday, 9:05 AM");
    expect(formatDuration(48)).toBe("0:48");
    expect(formatDuration(125)).toBe("2:05");
    expect(formatHours(3.24)).toBe("3.2h");
    expect(formatHours(null)).toBe("–");
  });
});

describe("csv", () => {
  it("quotes fields that need it", () => {
    expect(toCsv(["a", "b"], [["x, y", 'say "hi"']])).toBe('a,b\r\n"x, y","say ""hi"""\r\n');
  });

  it("words the family home's greeting and times", () => {
    expect(greetingFor(new Date(2026, 10, 7, 9))).toBe("Good morning");
    expect(greetingFor(new Date(2026, 10, 7, 14))).toBe("Good afternoon");
    expect(greetingFor(new Date(2026, 10, 7, 19))).toBe("Good evening");
    expect(formatDayAt(new Date(2026, 10, 7, 13, 43).toISOString(), now)).toBe("today at 1:43 PM");
    expect(formatDayAt(new Date(2026, 10, 6, 9, 5).toISOString(), now)).toBe("yesterday at 9:05 AM");
    expect(formatDayAt(new Date(2026, 10, 4, 15, 15).toISOString(), now)).toBe("Nov 4 at 3:15 PM");
    expect(formatWeekdayAt(new Date(2026, 10, 9, 10, 0).toISOString())).toBe("Mon Nov 9 at 10:00 AM");
    expect(formatTimer(83)).toBe("01:23");
    expect(formatTimer(180)).toBe("03:00");
  });
});
