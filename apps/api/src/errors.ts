/** An error whose message is safe to show to API clients. */
export class HttpError extends Error {
  constructor(
    readonly status: 400 | 403 | 404 | 409 | 413,
    message: string,
  ) {
    super(message);
  }
}

export function notFound(what: string): HttpError {
  return new HttpError(404, `${what} not found.`);
}
