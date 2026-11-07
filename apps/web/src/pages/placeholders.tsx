import { Link } from "react-router";
import { PageTitle } from "@/components/PageTitle";
import { Placeholder } from "@/components/Placeholder";

// Stand-ins for the routes built in tasks 3–5. Each later task replaces one.

// --- Nurse (Task 3 builds the triage queue and patient detail in pages/nurse/) ---
export const FamiliesPage = () => <Placeholder title="Families" task={3} />;
export const MessagesPage = () => <Placeholder title="Messages" task={3} />;
export const ScheduledCallsPage = () => <Placeholder title="Scheduled calls" task={3} />;
export const CareSummariesPage = () => <Placeholder title="Care summaries" task={5} />;
export const SettingsPage = () => <Placeholder title="Settings" task={5} />;

// --- Family (Task 4) ---
export const FamilyHomePage = () => <Placeholder title="Family home" task={4} />;
export const FamilyCheckInsPage = () => <Placeholder title="Check-ins" task={4} />;
export const FamilyHistoryPage = () => <Placeholder title="Health history" task={4} />;
export const FamilyCareTeamPage = () => <Placeholder title="Contact care team" task={4} />;
export const FamilyCalendarPage = () => <Placeholder title="Calendar" task={4} />;

// --- Shared (Task 5) ---
export function CareSummaryPage() {
  return (
    <main className="mx-auto max-w-[1000px] px-4 py-10">
      <Placeholder title="Care summary" task={5} />
    </main>
  );
}

export function NotFoundPage() {
  return (
    <main className="mx-auto max-w-[1000px] px-4 py-10">
      <PageTitle title="Page not found" subtitle="There's nothing at this address." />
      <Link to="/" className="font-medium text-brand underline-offset-4 hover:underline">
        Back to the start
      </Link>
    </main>
  );
}
