import { DOMAIN_KEYS, DOMAIN_NAMES, type DomainKey, type Domains } from "@careos/shared";
import { cn } from "@/lib/utils";

const DOMAIN_TONE: Partial<Record<DomainKey, string>> = {
  cognition: "bg-info-bg",
  caregiverStrain: "bg-sage-100",
};
const DEFAULT_TONE = "bg-watch-bg";

interface Segment {
  text: string;
  domain?: DomainKey;
}

/** Splits the transcript around each domain's quote. Overlapping quotes keep the earliest. */
function segment(transcript: string, domains: Domains): Segment[] {
  const spans = DOMAIN_KEYS.flatMap((domain) => {
    const quote = domains[domain].quote;
    if (!quote || domains[domain].severity === 0) return [];
    const start = transcript.indexOf(quote);
    return start === -1 ? [] : [{ domain, start, end: start + quote.length }];
  }).sort((a, b) => a.start - b.start);

  const segments: Segment[] = [];
  let cursor = 0;
  for (const span of spans) {
    if (span.start < cursor) continue;
    if (span.start > cursor) segments.push({ text: transcript.slice(cursor, span.start) });
    segments.push({ text: transcript.slice(span.start, span.end), domain: span.domain });
    cursor = span.end;
  }
  if (cursor < transcript.length) segments.push({ text: transcript.slice(cursor) });
  return segments;
}

/** The caregiver's words, with the phrases behind each flagged domain highlighted. */
export function HighlightedTranscript({
  transcript,
  domains,
  className,
}: {
  transcript: string;
  domains: Domains;
  className?: string;
}) {
  return (
    <blockquote className={cn("text-[15px] leading-relaxed text-ink", className)}>
      “
      {segment(transcript, domains).map((part, index) =>
        part.domain ? (
          <mark
            key={index}
            title={DOMAIN_NAMES[part.domain]}
            className={cn("rounded-control px-1 text-ink", DOMAIN_TONE[part.domain] ?? DEFAULT_TONE)}
          >
            {part.text}
            <span className="sr-only"> ({DOMAIN_NAMES[part.domain]})</span>
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
      ”
    </blockquote>
  );
}
