import { ok } from "@/lib/api";
import { getDeploymentTargets } from "@/lib/deploy-targets";
import { requireApiAuth } from "@/lib/api-auth";

export async function GET() {
  const auth = await requireApiAuth();
  if (auth) return auth;
  return ok({ targets: getDeploymentTargets() });
}