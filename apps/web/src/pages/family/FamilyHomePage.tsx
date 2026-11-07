import type { FamilyHomeResponse } from "@careos/shared";
import { Calendar, ChevronRight, FileText, MessageSquare, Mic, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { useFamilyHome } from "@/api/hooks";
import { EmergencyNotice } from "@/components/EmergencyNotice";
import { PageTitle } from "@/components/PageTitle";
import { VoiceCheckInDialog } from "@/components/family/VoiceCheckInDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { firstNameOf, formatDayAt, formatWeekdayAt, greetingFor } from "@/lib/format";

function checkInStatus(home: FamilyHomeResponse, nurse: string): string {
  const last = home.lastCheckIn;
  if (!last) return "No check-ins yet. Tap the mic to send your first.";
  const today = new Date(last.createdAt).toDateString() === new Date().toDateString();
  if (last.status === "guidance_sent") return `Nurse ${nurse} replied`;
  if (last.status === "reviewed") return `Nurse ${nurse} has read your latest check-in`;
  return today ? `Today's check-in is waiting for Nurse ${nurse}` : `Your last check-in is waiting for Nurse ${nurse}`;
}

function calendarStatus(home: FamilyHomeResponse): string {
  const next = home.nextCalendarItem;
  if (!next) return "Nothing scheduled yet";
  const title = next.title.charAt(0).toLowerCase() + next.title.slice(1);
  return `Next: ${title}, ${formatWeekdayAt(next.at)}`;
}

/** Sarah's home: one check-in button and four doors. Nothing else. */
export function FamilyHomePage() {
  const home = useFamilyHome();
  const [recording, setRecording] = useState(false);

  if (!home.data) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        <Skeleton className="h-24 w-full max-w-md" />
        <Skeleton className="h-[200px] w-full" />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(210px,100%),1fr))] gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[168px]" />
          ))}
        </div>
        {home.isError && <p className="text-body-2">We couldn't load your home page. Retrying…</p>}
      </div>
    );
  }

  const data = home.data;
  const caregiver = firstNameOf(data.caregiver.name);
  const patient = firstNameOf(data.patient.name);
  const nurseName = data.careTeam.nurse.name;
  const nurse = firstNameOf(nurseName);

  const blocks: Block[] = [
    { to: "/family/check-ins", icon: Mic, title: "Check-ins", status: checkInStatus(data, nurse), link: "View all" },
    { to: "/family/history", icon: FileText, title: "Health history", status: `Trends and notes from Nurse ${nurse}`, link: "Open" },
    {
      to: "/family/care-team",
      icon: MessageSquare,
      title: "Contact care team",
      status: `${nurseName}, ${data.careTeam.nurse.credentials} · replies within 4 hours`,
      link: "Message or call",
    },
    { to: "/family/calendar", icon: Calendar, title: "Calendar", status: calendarStatus(data), link: "See schedule" },
  ];

  return (
    <>
      <PageTitle
        size="greeting"
        title={`${greetingFor()}, ${caregiver}`}
        subtitle={<span className="text-lg">How is {patient} doing today?</span>}
      />

      <section
        aria-labelledby="check-in-title"
        className="relative overflow-hidden rounded-card border border-border bg-surface p-8"
      >
        <Decoration />
        <div className="relative flex flex-col items-center gap-6 text-center sm:flex-row sm:items-center sm:gap-8 sm:text-left">
          <button
            type="button"
            aria-label={`Start a voice check-in about ${patient}`}
            onClick={() => setRecording(true)}
            className="flex size-[140px] shrink-0 items-center justify-center rounded-full border-[10px] border-sage-50 bg-brand bg-clip-padding text-on-ink transition-colors hover:bg-brand-deep"
          >
            <Mic className="size-10" strokeWidth={1.75} aria-hidden />
          </button>
          <div className="min-w-0 lg:max-w-[430px]">
            <h2 id="check-in-title" className="text-[30px] leading-tight font-normal text-ink">
              Check in about {patient}
            </h2>
            <p className="mt-3 max-w-[430px] text-base leading-relaxed text-body-2">
              Tap and talk. Tell us how he's doing in your own words. Nurse {nurse} will see it.
            </p>
            <p className="mt-3 text-sm text-body-2">
              {data.lastCheckIn ? `Last check-in: ${formatDayAt(data.lastCheckIn.createdAt)}` : "No check-ins yet"}
            </p>
          </div>
        </div>
      </section>

      <nav aria-label={`About ${patient}`} className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(min(210px,100%),1fr))] gap-4">
        {blocks.map((block) => (
          <HomeBlock key={block.to} {...block} />
        ))}
      </nav>

      <EmergencyNotice variant="reminder" className="mt-7" />

      <VoiceCheckInDialog
        open={recording}
        onOpenChange={setRecording}
        patientId={data.patient.id}
        caregiverId={data.caregiver.id}
        patientFirstName={patient}
        nurseFirstName={nurse}
      />
    </>
  );
}

interface Block {
  to: string;
  icon: LucideIcon;
  title: string;
  status: string;
  link: string;
}

function HomeBlock({ to, icon: Icon, title, status, link }: Block) {
  return (
    <Link
      to={to}
      className="group flex min-h-[168px] flex-col rounded-card border border-border bg-surface p-[22px] transition-colors hover:border-sage-200 hover:bg-surface-hover"
    >
      <span className="flex size-11 items-center justify-center rounded-panel bg-sage-50 text-brand-deep" aria-hidden>
        <Icon className="size-5" strokeWidth={1.75} />
      </span>
      <span className="mt-3 text-xl font-medium text-ink">{title}</span>
      <span className="mt-2 text-sm leading-snug text-body-2">{status}</span>
      <span className="mt-auto flex items-center gap-1 pt-3 text-sm font-semibold text-brand">
        {link}
        <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </span>
    </Link>
  );
}

/** Three nested rounded squares at the card's right edge. Hidden where they'd sit under the text. */
function Decoration() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute top-1/2 -right-[72px] hidden size-[340px] -translate-y-1/2 items-center justify-center rounded-[96px] bg-sage-50 lg:flex"
    >
      <div className="flex size-[210px] items-center justify-center rounded-[64px] bg-sage-100">
        <div className="size-[110px] rounded-[36px] bg-sage-200" />
      </div>
    </div>
  );
}
