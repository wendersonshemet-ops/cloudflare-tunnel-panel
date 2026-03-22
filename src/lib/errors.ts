export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, options?: { code?: string; status?: number; details?: unknown }) {
    super(message);
    this.name = "AppError";
    this.code = options?.code ?? "APP_ERROR";
    this.status = options?.status ?? 400;
    this.details = options?.details;
  }
}

export function badRequest(message: string, details?: unknown) {
  return new AppError(message, { code: "BAD_REQUEST", status: 400, details });
}

export function validationError(message: string, details?: unknown) {
  return new AppError(message, { code: "VALIDATION_ERROR", status: 400, details });
}

export function notFound(message: string, details?: unknown) {
  return new AppError(message, { code: "NOT_FOUND", status: 404, details });
}

export function conflict(message: string, details?: unknown) {
  return new AppError(message, { code: "CONFLICT", status: 409, details });
}

export function externalError(message: string, details?: unknown) {
  return new AppError(message, { code: "EXTERNAL_ERROR", status: 502, details });
}

export function runtimeError(message: string, details?: unknown) {
  return new AppError(message, { code: "RUNTIME_ERROR", status: 500, details });
}
