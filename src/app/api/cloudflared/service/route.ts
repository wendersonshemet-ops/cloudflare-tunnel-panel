import { fail } from "@/lib/api";
import { requireApiAuth } from "@/lib/api-auth";

export async function POST() {
  const auth = await requireApiAuth();
  if (auth) return auth;

  return fail({
    message: "Unsupported in remote-docker-only mode. The cloudflared container lifecycle is managed externally by Docker.",
  }, 409);
}
