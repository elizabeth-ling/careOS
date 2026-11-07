import { createBrowserRouter, RouterProvider } from "react-router";
import { FamilyLayout } from "@/layouts/FamilyLayout";
import { NurseLayout } from "@/layouts/NurseLayout";
import { EntryPage } from "@/pages/EntryPage";
import {
  CareSummariesPage,
  CareSummaryPage,
  FamiliesPage,
  MessagesPage,
  NotFoundPage,
  ScheduledCallsPage,
  SettingsPage,
} from "@/pages/placeholders";
import { FamilyCalendarPage } from "@/pages/family/FamilyCalendarPage";
import { FamilyCareTeamPage } from "@/pages/family/FamilyCareTeamPage";
import { FamilyCheckInsPage } from "@/pages/family/FamilyCheckInsPage";
import { FamilyHistoryPage } from "@/pages/family/FamilyHistoryPage";
import { FamilyHomePage } from "@/pages/family/FamilyHomePage";
import { PatientDetailPage } from "@/pages/nurse/PatientDetailPage";
import { TriageQueuePage } from "@/pages/nurse/TriageQueuePage";

const router = createBrowserRouter([
  { path: "/", element: <EntryPage /> },
  {
    path: "/nurse",
    element: <NurseLayout />,
    children: [
      { index: true, element: <TriageQueuePage /> },
      { path: "patients/:id", element: <PatientDetailPage /> },
      { path: "families", element: <FamiliesPage /> },
      { path: "messages", element: <MessagesPage /> },
      { path: "calls", element: <ScheduledCallsPage /> },
      { path: "summaries", element: <CareSummariesPage /> },
      { path: "settings", element: <SettingsPage /> },
    ],
  },
  {
    path: "/family",
    element: <FamilyLayout />,
    children: [
      { index: true, element: <FamilyHomePage /> },
      { path: "check-ins", element: <FamilyCheckInsPage /> },
      { path: "history", element: <FamilyHistoryPage /> },
      { path: "care-team", element: <FamilyCareTeamPage /> },
      { path: "calendar", element: <FamilyCalendarPage /> },
    ],
  },
  { path: "/summary/:patientId", element: <CareSummaryPage /> },
  { path: "*", element: <NotFoundPage /> },
]);

export function App() {
  return <RouterProvider router={router} />;
}
