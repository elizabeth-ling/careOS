import { describe, expect, it } from "vitest";
import {
  DOMAIN_KEYS,
  EMERGENCY_TERMS,
  dropUnmatchedQuotes,
  findEmergencyTerms,
  observations,
  quotesMatchTranscript,
  redFlags,
  scoreCheckIn,
  tierFor,
  type Baselines,
  type DomainKey,
  type Domains,
  type RedFlag,
  type Severity,
} from "./index";

function domains(severities: Partial<Record<DomainKey, Severity>> = {}): Domains {
  const result = {} as Domains;
  for (const key of DOMAIN_KEYS) {
    result[key] = { severity: severities[key] ?? 0, summary: "", quote: null };
  }
  return result;
}

function baselines(values: Partial<Baselines> = {}): Baselines {
  const result = {} as Baselines;
  for (const key of DOMAIN_KEYS) result[key] = values[key] ?? 0;
  return result;
}

describe("tierFor", () => {
  it.each([
    [100, "urgent"],
    [70, "urgent"],
    [69, "watch"],
    [40, "watch"],
    [39, "stable"],
    [0, "stable"],
  ])("maps %i to %s", (score, tier) => {
    expect(tierFor(score)).toBe(tier);
  });
});

describe("redFlags", () => {
  const points = (transcript: string, d = domains()) =>
    redFlags(transcript, d).map((flag) => [flag.key, flag.points]);

  it("scores new confusion when severe cognition comes with a first-time cue", () => {
    expect(
      points("He called me by my mom's name, which he's never done before.", domains({ cognition: 3 })),
    ).toEqual([["newConfusion", 25]]);
  });

  it("doesn't treat ongoing forgetfulness as new confusion", () => {
    expect(points("He forgot his glasses again.", domains({ cognition: 1 }))).toEqual([]);
    expect(points("He has never done the crossword.", domains({ cognition: 1 }))).toEqual([]);
  });

  it("scores a reported fall", () => {
    expect(points("She fell in the bathroom this morning.")).toEqual([["fall", 30]]);
  });

  it.each(["No falls this week.", "He didn't fall.", "She hasn't fallen since spring."])(
    "ignores the negated fall in %j",
    (text) => {
      expect(points(text)).toEqual([]);
    },
  );

  it("still scores a fall when a different sentence is negative", () => {
    expect(points("No pain today. She fell last night.")).toEqual([["fall", 30]]);
  });

  it("scores not eating for two or more days", () => {
    expect(points("He hasn't eaten properly in two days.")).toEqual([["notEating", 20]]);
    expect(points("He's not been eating for a couple of days.")).toEqual([["notEating", 20]]);
  });

  it("doesn't score one poor meal as not eating", () => {
    expect(points("Dad barely touched his dinner again tonight, maybe a few bites.")).toEqual([]);
  });

  it.each(EMERGENCY_TERMS)("scores the emergency term %j", (term) => {
    expect(points(`Please help, ${term} right now.`)).toContainEqual(["emergency", 60]);
  });

  it("matches emergency terms regardless of case or typographic apostrophes", () => {
    expect(findEmergencyTerms("He CAN’T BREATHE")).toEqual(["can't breathe"]);
    expect(findEmergencyTerms("She cannot breathe")).toEqual(["can't breathe"]);
  });

  it("errs on the side of the banner for a negated emergency term", () => {
    expect(findEmergencyTerms("No chest pain today.")).toEqual(["chest pain"]);
  });

  it("doesn't match an emergency term inside another word", () => {
    expect(findEmergencyTerms("She stroked the cat.")).toEqual([]);
  });
});

describe("observations", () => {
  it("counts missed medications", () => {
    expect(observations("She missed her pills twice this week.")).toEqual(["Missed meds ×2"]);
  });

  it("notes breathlessness on stairs", () => {
    expect(observations("He gets breathless on the stairs now.")).toEqual(["Breathless on stairs"]);
  });

  it("finds nothing in an unremarkable transcript", () => {
    expect(observations("She took her pills and slept well.")).toEqual([]);
  });
});

describe("scoreCheckIn", () => {
  const fall: RedFlag = { key: "fall", label: "Fall reported", points: 30 };
  const confusion: RedFlag = { key: "newConfusion", label: "New confusion", points: 25 };
  const emergency: RedFlag = { key: "emergency", label: "Emergency terms", points: 60 };

  it("adds red flags, severities x 6, and 4 per domain above baseline", () => {
    const result = scoreCheckIn({
      redFlags: [fall],
      domains: domains({ mobility: 3, pain: 1, sleep: 1, mood: 1 }),
      baselines: baselines({ sleep: 1, mood: 1 }),
    });
    expect(result.score).toBe(30 + 6 * 6 + 2 * 4);
    expect(result.tier).toBe("urgent");
  });

  it("caps the score at 100", () => {
    const result = scoreCheckIn({
      redFlags: [fall, emergency],
      domains: domains({ mobility: 3, pain: 3 }),
      baselines: baselines(),
    });
    expect(result.score).toBe(100);
    expect(result.isEmergency).toBe(true);
  });

  it("doesn't count a domain equal to its baseline as above it", () => {
    const result = scoreCheckIn({
      redFlags: [],
      domains: domains({ sleep: 1 }),
      baselines: baselines({ sleep: 1 }),
    });
    expect(result.score).toBe(6);
  });

  it("scores zero for a check-in with nothing in it", () => {
    expect(scoreCheckIn({ redFlags: [], domains: domains(), baselines: baselines() })).toEqual({
      score: 0,
      tier: "stable",
      flags: [],
      isEmergency: false,
    });
  });

  it("labels flags with how long a domain has declined", () => {
    const result = scoreCheckIn({
      redFlags: [],
      domains: domains({ appetite: 2, sleep: 2, mobility: 2 }),
      baselines: baselines(),
      declineDays: { appetite: 21, sleep: 10 },
    });
    expect(result.flags).toEqual(["Appetite ↓ 3 wks", "Sleep ↓ 10 days", "Mobility ↓"]);
  });

  it("doesn't flag a mild domain, or one at its usual level", () => {
    const result = scoreCheckIn({
      redFlags: [],
      domains: domains({ mood: 1, sleep: 2 }),
      baselines: baselines({ sleep: 2 }),
    });
    expect(result.flags).toEqual([]);
  });

  it("doesn't repeat cognition next to new confusion, or medications next to missed meds", () => {
    const result = scoreCheckIn({
      redFlags: [confusion],
      domains: domains({ cognition: 3, medications: 2 }),
      baselines: baselines(),
      observations: ["Missed meds ×2"],
    });
    expect(result.flags).toEqual(["New confusion", "Missed meds ×2"]);
  });

  it("flags caregiver strain even at the caregiver's usual level", () => {
    const result = scoreCheckIn({
      redFlags: [],
      domains: domains({ caregiverStrain: 2 }),
      baselines: baselines({ caregiverStrain: 2 }),
    });
    expect(result.flags).toEqual(["Caregiver strain"]);
  });
});

describe("quote helpers", () => {
  const d = domains();
  d.appetite.quote = "barely touched";
  d.mood.quote = "not in the transcript";

  it("detects quotes that aren't exact substrings", () => {
    expect(quotesMatchTranscript("He barely touched it.", d)).toBe(false);
  });

  it("clears only the unmatched quotes", () => {
    const cleaned = dropUnmatchedQuotes("He barely touched it.", d);
    expect(cleaned.appetite.quote).toBe("barely touched");
    expect(cleaned.mood.quote).toBeNull();
    expect(quotesMatchTranscript("He barely touched it.", cleaned)).toBe(true);
  });
});
