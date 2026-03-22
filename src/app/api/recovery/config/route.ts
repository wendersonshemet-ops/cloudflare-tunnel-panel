import { fail } from "@/lib/api";
import { requireApiAuth } from "@/lib/api-auth";

export async function GET() {
  const auth = await requireApiAuth();
  if (auth) return auth;

  return fail({
    message: "Unsupported in remote-docker-only mode. CTP does not read or recover bindings from local cloudflared config files.",
  }, 409);
}

export async function POST() {
  const auth = await requireApiAuth();
  if (auth) return auth;

  return fail({
    message: "Unsupported in remote-docker-only mode. CTP does not read or recover bindings from local cloudflared config files.",
  }, 409);
}
