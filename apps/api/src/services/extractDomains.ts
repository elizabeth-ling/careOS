import {
  DOMAIN_KEYS,
  domainsSchema,
  normalizeTranscript,
  type DomainKey,
  type Domains,
  type Severity,
} from "@careos/shared";

/** The seam Task 5 uses to swap the keyword rules for Claude. */
export interface DomainExtractor {
  extractDomains(transcript: string): Promise<Domains>;
}

type Rule = readonly [RegExp, Severity];

/**
 * Within a clause the first matching rule wins, so negative phrasing comes before
 * the keywords it contains, and the bare keyword from the spec comes last.
 */
const RULES: Record<DomainKey, readonly Rule[]> = {
  appetite: [
    [/\b(hasn't|not|hardly|stopped|refus\w+)\s+(been\s+|to\s+)?(eating|eaten|eat|ate)\b/, 3],
    [/\bbarely (touched|ate|eating)\b|\bhalf portions?\b|\bskipp\w+ (dinner|lunch|breakfast|meals?)\b/, 2],
    [/\bate (well|everything|all)\b|\beating well\b|\bgood appetite\b|\bfinished (his|her) (dinner|lunch|breakfast)\b/, 0],
    [/\b(dinner|ate|eating|lunch|breakfast|appetite)\b/, 1],
  ],
  sleep: [
    [/\b(up all night|up most of the night|hardly slept|barely slept)\b/, 3],
    [/\b(up|woke( up)?) (two|three|four|several) times\b|\brestless night\b|\bpoor night\b/, 2],
    [/\bslept (well|fine|through)\b|\bgood night's sleep\b/, 0],
    [/\b(sleep|slept|napp\w+|restless)\b/, 1],
  ],
  mobility: [
    [/\b(no|not|never|without|didn't|hasn't|haven't|hadn't)\b.*\b(fell|falls?|fallen)\b/, 0],
    [/\b(fell|falls?|fallen|can't get up|not breathing|can't breathe)\b/, 3],
    [/\bunsteady\b|\bneed(s|ed)? help (walking|standing|getting up)\b|\bwalker more\b/, 2],
    [/\bwalk(ed|ing)? (well|fine)\b|\bsteady on (his|her) feet\b/, 0],
    [/\b(breathless|short of breath|out of breath|shuffling|slower)\b/, 1],
  ],
  cognition: [
    [/\bmom's name\b|\bdidn't recogni[sz]e\b|\bunconscious\b|\bstroke\b/, 3],
    [/\bconfused\b|\bgot lost\b/, 2],
    [/\b(sharp|clear-headed)\b/, 0],
    [/\bforgot\b|\bforgetful\b|\bmixed up\b/, 1],
  ],
  mood: [
    [/\bhopeless\b|\bwon't stop crying\b/, 3],
    [/\btearful\b|\bagitated\b|\bvery (down|low|sad)\b/, 2],
    [/\bgood spirits\b|\bcheerful\b/, 0],
    [/\bseemed? (a bit |a little )?off\b|\b(a bit|a little) (down|low|quiet|flat)\b/, 1],
  ],
  pain: [
    [/\bchest pain\b|\bbleeding heavily\b|\bsevere pain\b/, 3],
    [/\b(a lot of|bad) pain\b|\breally hurting\b/, 2],
    [/\bno pain\b|\bpain[- ]free\b/, 0],
    [/\bsore\b|\baching\b|\bachy\b|\bstiff\b|\bpain\b/, 1],
  ],
  medications: [
    [/\b(refus\w+|stopped taking) (his|her|all)?\s*(pills|medications?|meds)\b/, 3],
    [/\b(missed|skipped)\b.*\b(pills?|medications?|meds|insulin|doses?)\b/, 2],
    [/\b(take|took|taken|taking) (all |all of )?(his|her) (pills|medications?|meds|insulin)\b/, 0],
    [/\b(pills?|medications?|meds)\b/, 1],
  ],
  caregiverStrain: [
    [/\boverwhelmed\b|\bbreaking point\b|\bcan't keep (doing|going)\b/, 3],
    [/\bexhausted\b|\bworn out\b/, 2],
    [/\b(well rested|rested)\b/, 0],
    [/\btired\b/, 1],
  ],
};

const SUMMARIES: Record<DomainKey, Record<Severity, string>> = {
  appetite: {
    0: "Eating normally.",
    1: "Eating a little less than usual.",
    2: "Eating much less than usual.",
    3: "Hardly eating at all.",
  },
  sleep: {
    0: "Sleeping normally.",
    1: "Sleep slightly unsettled.",
    2: "Waking repeatedly at night.",
    3: "Barely sleeping.",
  },
  mobility: {
    0: "Getting around as usual.",
    1: "Slower or more effort getting around.",
    2: "Needs more help getting around.",
    3: "Serious mobility event reported.",
  },
  cognition: {
    0: "Memory and thinking as usual.",
    1: "Some forgetfulness.",
    2: "Episodes of confusion.",
    3: "Significant change in memory or awareness.",
  },
  mood: {
    0: "Mood as usual.",
    1: "Seems a little off or low.",
    2: "Noticeably upset or agitated.",
    3: "Severe distress reported.",
  },
  pain: {
    0: "No pain mentioned as a concern.",
    1: "Mild aches or soreness.",
    2: "Significant pain.",
    3: "Severe pain or a serious symptom reported.",
  },
  medications: {
    0: "Taking medications as prescribed.",
    1: "Medications mentioned, with some concern.",
    2: "Missed doses reported.",
    3: "Refusing or stopped medications.",
  },
  caregiverStrain: {
    0: "Caregiver coping well.",
    1: "Caregiver reports feeling tired.",
    2: "Caregiver reports exhaustion.",
    3: "Caregiver reports being overwhelmed.",
  },
};

const NOT_MENTIONED = "Not mentioned in this check-in.";

/** Spans of the transcript split at sentence ends and commas, trimmed. Each is an exact substring. */
function clauses(transcript: string): string[] {
  return transcript
    .split(/(?<=[.!?])\s+|,\s+/)
    .map((clause) => clause.trim())
    .filter((clause) => clause.length > 0);
}

export function extractDomainsFromKeywords(transcript: string): Domains {
  const parts = clauses(transcript);
  const domains = {} as Domains;

  for (const key of DOMAIN_KEYS) {
    let best: { severity: Severity; quote: string } | null = null;

    for (const clause of parts) {
      const text = normalizeTranscript(clause);
      const rule = RULES[key].find(([pattern]) => pattern.test(text));
      if (rule && (best === null || rule[1] > best.severity)) {
        best = { severity: rule[1], quote: clause };
      }
    }

    domains[key] = best
      ? { severity: best.severity, summary: SUMMARIES[key][best.severity], quote: best.quote }
      : { severity: 0, summary: NOT_MENTIONED, quote: null };
  }

  return domainsSchema.parse(domains);
}

export const keywordExtractor: DomainExtractor = {
  extractDomains: async (transcript) => extractDomainsFromKeywords(transcript),
};

export function extractDomains(transcript: string): Promise<Domains> {
  return keywordExtractor.extractDomains(transcript);
}
