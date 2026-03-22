import { redirect } from "next/navigation";
import { LoginScreen } from "@/components/login-screen";
import { isAuthEnabled, isAuthenticated } from "@/lib/auth";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; password?: string }> }) {
  if (!isAuthEnabled()) {
    redirect("/");
  }

  if (await isAuthenticated()) {
    redirect("/");
  }

  const params = await searchParams;
  const error = params.error || "";
  const next = params.next || "/";

  return <LoginScreen initialError={error} initialNext={next} />;
}
