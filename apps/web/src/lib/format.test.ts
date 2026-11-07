import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";
import { formatDayTime, formatDuration, formatHours, formatRelative, joinWithAnd, shortNameOf } from "./format";

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
});
