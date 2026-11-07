import { guidanceDraftsResponseSchema, type GuidanceDraft } from "@careos/shared";

const firstName = (name: string) => name.split(" ")[0] ?? name;

function detailedBody(name: string, flags: readonly string[]): string {
  const has = (text: string) => flags.some((flag) => flag.startsWith(text));

  if (has("Emergency")) {
    return `${name}, what you've described may be an emergency. Please call 911 now if you haven't already. I'll call you as soon as you're able to talk.`;
  }
  if (has("New confusion") && has("Appetite")) {
    return `Thanks ${name}. New confusion plus lower appetite is worth checking. Can you look for signs of a UTI (fever, burning, going more often) and offer extra fluids? I'll call you today at 4 PM.`;
  }
  if (has("Fall")) {
    return `Thanks ${name}. I'm glad you told me about the fall. Please watch for new pain, swelling, bruising or confusion over the next day, and keep the path to the bathroom clear and well lit. I'll call you today to go through what happened.`;
  }
  if (has("Sleep")) {
    return `Thanks ${name}. Several poor nights in a row is hard on both of you. Try keeping a steady bedtime, limit long naps during the day, and note what time the waking happens. I'll review it with you on our next call.`;
  }
  if (has("Missed meds")) {
    return `Thanks ${name}. Let's make the missed doses easier to avoid. A weekly pill organizer and a phone reminder at the same time each day often help. Don't double up on a missed dose. I'll check in again later this week.`;
  }
  if (has("Breathless")) {
    return `Thanks ${name}. Getting more breathless on the stairs is worth tracking. Encourage slow pacing and rests on the way up, and let me know if it starts happening at rest. I'll follow up later this week.`;
  }
  if (flags.length > 0) {
    return `Thanks ${name}. I've looked at today's update: ${flags.join(", ").toLowerCase()}. Please keep doing what you're doing and tell me if anything changes. I'll follow up with you this week.`;
  }
  return `Thanks ${name}. Everything looks steady compared with recent weeks. Keep up the good work, and let me know if anything changes.`;
}

/** Three suggested replies built from a check-in's flags. Task 5 may generate these with Claude. */
export function buildGuidanceDrafts(caregiverName: string, flags: readonly string[]): GuidanceDraft[] {
  const name = firstName(caregiverName);

  return guidanceDraftsResponseSchema.parse([
    { kind: "detailed", label: "Suggested next steps", body: detailedBody(name, flags) },
    {
      kind: "reassurance",
      label: "Reassurance and plan",
      body: `Thanks for letting me know, ${name}. You're doing the right thing by keeping track of this. I've reviewed the update and will follow up with you by phone within a day.`,
    },
    {
      kind: "escalation",
      label: "When to escalate",
      body: `Thanks ${name}. Please call 811 or go to urgent care if things get worse, for example a fever, more confusion, or not drinking. If you ever see chest pain, trouble breathing or signs of a stroke, call 911 right away.`,
    },
  ]);
}
