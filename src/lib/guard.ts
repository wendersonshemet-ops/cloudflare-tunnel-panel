import { isAuthenticated } from "@/lib/auth";

export async function isPageAuthenticated() {
  return isAuthenticated();
}
