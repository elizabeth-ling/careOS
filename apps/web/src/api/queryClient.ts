import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError, ApiUnreachableError } from "./api";

/** A short, friendly sentence for a toast. Never a stack trace. */
export function friendlyMessage(error: unknown): string {
  if (error instanceof ApiUnreachableError) {
    return "Can't reach the CareOS server. Please try again in a moment.";
  }
  if (error instanceof ApiError) {
    if (error.status === 404) return "We couldn't find that. It may have been removed.";
    if (error.status >= 500) return "Something went wrong on the server. Please try again.";
    return error.message;
  }
  return "Something went wrong. Please try again.";
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      // An unreachable server is shown once, as the top banner, not as a toast per query.
      if (error instanceof ApiUnreachableError) return;
      // The id stops a polling query from stacking up identical toasts.
      toast.error(friendlyMessage(error), { id: query.queryHash });
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      toast.error(friendlyMessage(error));
    },
  }),
  defaultOptions: {
    queries: {
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status < 500) && failureCount < 1,
      retryDelay: 1000,
      refetchOnWindowFocus: true,
    },
    mutations: { retry: false },
  },
});
