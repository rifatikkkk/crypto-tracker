export type HttpError = Error & { status: number };

export const httpError = (status: number, message: string): HttpError =>
  Object.assign(new Error(message), { status });

export const isHttpError = (error: unknown): error is HttpError =>
  error instanceof Error &&
  "status" in error &&
  typeof error.status === "number";
