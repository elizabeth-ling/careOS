import type {
  CheckIn,
  ConfirmCallRequest,
  CreateCallRequest,
  CreateCheckInFields,
  CreateMessageRequest,
  GuidanceRequest,
  QueueFilter,
  QueueSort,
  ScheduleCallRequest,
  SimulateRequest,
} from "@careos/shared";
import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api } from "./api";

/** How often the live lists refresh, so a check-in in one window shows up in another. */
export const POLL_MS = 4000;

/**
 * Query keys. Everything about one patient lives under ["patients", id], so a
 * mutation can refresh all of it with a single invalidation.
 */
export const keys = {
  health: ["health"] as const,
  queue: (filter: QueueFilter, sort: QueueSort) => ["queue", filter, sort] as const,
  queueAll: ["queue"] as const,
  patient: (id: string) => ["patients", id] as const,
  patientDetail: (id: string) => ["patients", id, "detail"] as const,
  checkIns: (id: string, limit: number) => ["patients", id, "check-ins", limit] as const,
  trends: (id: string, days: number) => ["patients", id, "trends", days] as const,
  nurseActions: (id: string) => ["patients", id, "actions"] as const,
  messages: (id: string) => ["patients", id, "messages"] as const,
  callRequests: (id: string) => ["patients", id, "call-requests"] as const,
  calendar: (id: string) => ["patients", id, "calendar"] as const,
  careSummary: (id: string) => ["patients", id, "summary"] as const,
  guidanceDrafts: (checkInId: string) => ["check-ins", checkInId, "guidance-drafts"] as const,
  familyHome: (patientId?: string) => ["family-home", patientId ?? "hero"] as const,
  familyHomeAll: ["family-home"] as const,
};

function invalidate(client: QueryClient, ...queryKeys: (readonly unknown[])[]) {
  return Promise.all(queryKeys.map((queryKey) => client.invalidateQueries({ queryKey })));
}

/** A check-in changed: the queue, that patient's pages and the family home all show it. */
function invalidateCheckIn(client: QueryClient, checkIn: Pick<CheckIn, "id" | "patientId">) {
  return invalidate(
    client,
    keys.queueAll,
    keys.patient(checkIn.patientId),
    keys.familyHomeAll,
    keys.guidanceDrafts(checkIn.id),
  );
}

// --- Queries ---------------------------------------------------------------

export function useHealth() {
  return useQuery({ queryKey: keys.health, queryFn: api.health, refetchInterval: 30_000, staleTime: 15_000 });
}

export function useQueue(filter: QueueFilter = "all", sort: QueueSort = "risk") {
  return useQuery({
    queryKey: keys.queue(filter, sort),
    queryFn: () => api.queue(filter, sort),
    refetchInterval: POLL_MS,
    // Changing the filter or sort keeps the current table on screen until the new one loads.
    placeholderData: keepPreviousData,
  });
}

export function usePatient(id: string | undefined) {
  return useQuery({
    queryKey: keys.patientDetail(id ?? ""),
    queryFn: () => api.patient(id!),
    enabled: Boolean(id),
  });
}

export function useCheckIns(patientId: string | undefined, limit = 50) {
  return useQuery({
    queryKey: keys.checkIns(patientId ?? "", limit),
    queryFn: () => api.checkIns(patientId!, limit),
    enabled: Boolean(patientId),
    refetchInterval: POLL_MS,
  });
}

export function useTrends(patientId: string | undefined, days = 42) {
  return useQuery({
    queryKey: keys.trends(patientId ?? "", days),
    queryFn: () => api.trends(patientId!, days),
    enabled: Boolean(patientId),
  });
}

/** `poll` keeps the list live, e.g. so a family sees the nurse's reply without a reload. */
export function useNurseActions(patientId: string | undefined, { poll = false } = {}) {
  return useQuery({
    queryKey: keys.nurseActions(patientId ?? ""),
    queryFn: () => api.nurseActions(patientId!),
    enabled: Boolean(patientId),
    refetchInterval: poll ? POLL_MS : false,
  });
}

export function useGuidanceDrafts(checkInId: string | undefined) {
  return useQuery({
    queryKey: keys.guidanceDrafts(checkInId ?? ""),
    queryFn: () => api.guidanceDrafts(checkInId!),
    enabled: Boolean(checkInId),
  });
}

/** Without a patient id the API answers for the demo's hero patient. */
export function useFamilyHome(patientId?: string) {
  return useQuery({
    queryKey: keys.familyHome(patientId),
    queryFn: () => api.familyHome(patientId),
    refetchInterval: POLL_MS,
  });
}

export function useMessages(patientId: string | undefined) {
  return useQuery({
    queryKey: keys.messages(patientId ?? ""),
    queryFn: () => api.messages(patientId!),
    enabled: Boolean(patientId),
    refetchInterval: POLL_MS,
  });
}

export function useCallRequests(patientId: string | undefined) {
  return useQuery({
    queryKey: keys.callRequests(patientId ?? ""),
    queryFn: () => api.callRequests(patientId!),
    enabled: Boolean(patientId),
  });
}

export function useCalendar(patientId: string | undefined) {
  return useQuery({
    queryKey: keys.calendar(patientId ?? ""),
    queryFn: () => api.calendar(patientId!),
    enabled: Boolean(patientId),
    // A nurse confirming a call request in another window shows up here.
    refetchInterval: POLL_MS,
  });
}

export function useCareSummary(patientId: string | undefined) {
  return useQuery({
    queryKey: keys.careSummary(patientId ?? ""),
    queryFn: () => api.careSummary(patientId!),
    enabled: Boolean(patientId),
  });
}

// --- Mutations -------------------------------------------------------------

export function useSendGuidance() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ checkInId, ...input }: GuidanceRequest & { checkInId: string }) =>
      api.sendGuidance(checkInId, input),
    onSuccess: (result) => invalidateCheckIn(client, result.checkIn),
  });
}

export function useMarkReviewed() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (checkInId: string) => api.markReviewed(checkInId),
    onSuccess: (result) => invalidateCheckIn(client, result.checkIn),
  });
}

export function useScheduleCall() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ patientId, ...input }: ScheduleCallRequest & { patientId: string }) =>
      api.scheduleCall(patientId, input),
    onSuccess: (action) =>
      invalidate(client, keys.queueAll, keys.patient(action.patientId), keys.familyHomeAll),
  });
}

export function useGenerateCallNote() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (patientId: string) => api.generateCallNote(patientId),
    onSuccess: (action) => invalidate(client, keys.queueAll, keys.patient(action.patientId)),
  });
}

export function useCreateCheckIn() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ audio, ...fields }: CreateCheckInFields & { audio?: Blob }) =>
      api.createCheckIn(fields, audio),
    onSuccess: (checkIn) => invalidateCheckIn(client, checkIn),
  });
}

export function useSimulateCheckIn() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: SimulateRequest) => api.simulateCheckIn(input),
    onSuccess: (checkIn) => invalidateCheckIn(client, checkIn),
  });
}

export function useSendMessage() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ patientId, ...input }: CreateMessageRequest & { patientId: string }) =>
      api.sendMessage(patientId, input),
    // The queue carries the unread-message count shown in the nurse sidebar.
    onSuccess: (message) => invalidate(client, keys.messages(message.patientId), keys.queueAll),
  });
}

export function useMarkMessagesRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (patientId: string) => api.markMessagesRead(patientId),
    onSuccess: (_messages, patientId) => invalidate(client, keys.messages(patientId), keys.queueAll),
  });
}

export function useCreateCallRequest() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ patientId, ...input }: CreateCallRequest & { patientId: string }) =>
      api.createCallRequest(patientId, input),
    onSuccess: (request) => invalidate(client, keys.patient(request.patientId), keys.familyHomeAll),
  });
}

export function useConfirmCallRequest() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ callRequestId, ...input }: ConfirmCallRequest & { callRequestId: string }) =>
      api.confirmCallRequest(callRequestId, input),
    onSuccess: (request) =>
      invalidate(client, keys.queueAll, keys.patient(request.patientId), keys.familyHomeAll),
  });
}

/** Restores the seed data, so every cached query is stale afterwards. */
export function useDemoReset() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api.demoReset(),
    onSuccess: () => client.invalidateQueries(),
  });
}
