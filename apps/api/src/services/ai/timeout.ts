export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} timed out after ${ms / 1000}s.`);
    this.name = "TimeoutError";
  }
}

/**
 * Runs `task` with an AbortSignal that fires after `ms`, and rejects at `ms` even
 * if the task ignores the signal. An outer signal (e.g. the whole pipeline's
 * budget) aborts it too.
 */
export async function withTimeout<T>(
  label: string,
  ms: number,
  task: (signal: AbortSignal) => Promise<T>,
  outer?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const signal = outer ? AbortSignal.any([controller.signal, outer]) : controller.signal;
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new TimeoutError(label, ms);
      controller.abort(error);
      reject(error);
    }, ms);
  });
  try {
    return await Promise.race([task(signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
