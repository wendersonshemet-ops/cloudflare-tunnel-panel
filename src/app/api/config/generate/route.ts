import { fail } from "@/lib/api";
import { requireApiAuth } from "@/lib/api-auth";

export async function POST() {
  const auth = await requireApiAuth();
  if (auth) return auth;

  return fail({
    message: "Unsupported in remote-docker-only mode. CTP no longer generates or applies local cloudflared config files.",
  }, 409);
}
