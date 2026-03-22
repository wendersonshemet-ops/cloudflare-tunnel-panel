import { LoginForm } from "@/components/login-form";
import styles from "@/app/login/page.module.css";

export function LoginScreen({ initialError = "", initialNext = "/" }: { initialError?: string; initialNext?: string }) {
  return (
    <main className={styles.page}>
      <LoginForm initialError={initialError} initialNext={initialNext} />
    </main>
  );
}
