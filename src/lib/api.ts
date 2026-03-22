import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";

export type ApiError = {
  message: string;
  code?: string;
  details?: unknown;
};

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(error: ApiError, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

export function fromUnknownError(err: unknown, fallback = "请求失败"): ApiError {
  if (err instanceof AppError) {
    return { message: err.message, code: err.code, details: err.details };
  }
  if (err instanceof Error) {
    return { message: err.message };
  }
  if (typeof err === "string") {
    return { message: err };
  }
  return { message: fallback, details: err };
}

export function statusFromError(err: unknown, fallback = 400) {
  return err instanceof AppError ? err.status : fallback;
}
