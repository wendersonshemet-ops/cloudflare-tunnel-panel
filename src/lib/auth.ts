import crypto from "node:crypto";
import { cookies } from "next/headers";
import { getSettings } from "@/lib/settings";

const COOKIE_NAME = "ctp_session";

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function getPassword() {
  const settings = getSettings();
  return settings.panelPassword || process.env.PANEL_PASSWORD || "";
}

export function isAuthEnabled() {
  return Boolean(getPassword());
}

export async function isAuthenticated() {
  if (!isAuthEnabled()) return true;
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value || "";
  return token === sha256(getPassword());
}

export async function createSession() {
  const store = await cookies();
  store.set(COOKIE_NAME, sha256(getPassword()), {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.set(COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export function verifyPassword(password: string) {
  const expected = getPassword();
  return Boolean(expected) && password === expected;
}
