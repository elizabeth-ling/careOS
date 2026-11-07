import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/api";

/**
 * Demo identity. CareOS has no sign-in for the hackathon: the family view acts
 * as the hero patient's caregiver, and the nurse view as that patient's primary
 * nurse. Both come from the API, loaded once per session.
 *
 * TODO(auth): replace this with the signed-in user's session. Real auth would
 * return the caregiver or nurse from a session endpoint, and the API would
 * scope every request to the patients that user may see.
 */
export interface DemoIdentity {
  heroPatientId: string;
  caregiverId: string;
  nurseId: string;
}

async function loadDemoIdentity() {
  // GET /family/home with no patient id answers for the hero patient, and
  // includes the care team. The queue confirms who the nurse is looking after.
  const [home, queue] = await Promise.all([api.familyHome(), api.queue("all", "risk")]);
  const heroRow = queue.rows.find((row) => row.patient.id === home.patient.id);
  const identity: DemoIdentity = {
    heroPatientId: home.patient.id,
    caregiverId: home.caregiver.id,
    nurseId: heroRow?.patient.primaryNurseId ?? home.careTeam.nurse.id,
  };
  return {
    ...identity,
    patient: home.patient,
    caregiver: home.caregiver,
    nurse: home.careTeam.nurse,
    careHome: home.careTeam.careHome,
  };
}

export function useDemoIdentity(enabled = true) {
  return useQuery({
    queryKey: ["demo-identity"],
    queryFn: loadDemoIdentity,
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

/**
 * Shift details for the sidebar's "On shift" panel. The API has no rota yet,
 * so these two values are demo configuration (the family count is live).
 * TODO(rota): load from a shift endpoint once one exists.
 */
export const DEMO_SHIFT = {
  nursesOnShift: 3,
  endsAtHour: 19,
} as const;
