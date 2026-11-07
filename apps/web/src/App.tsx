import { createBrowserRouter, RouterProvider } from "react-router";
import { FamilyLayout } from "@/layouts/FamilyLayout";
import { NurseLayout } from "@/layouts/NurseLayout";
import { EntryPage } from "@/pages/EntryPage";
import {
  CareSummariesPage,
  CareSummaryPage,
  FamiliesPage,
  FamilyCalendarPage,
  FamilyCareTeamPage,
  FamilyCheckInsPage,
  FamilyHistoryPage,
  FamilyHomePage,
  MessagesPage,
  NotFoundPage,
  PatientDetailPage,
  ScheduledCallsPage,
  SettingsPage,
  TriageQueuePage,
} from "@/pages/placeholders";

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
