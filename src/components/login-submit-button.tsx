"use client";

import { useFormStatus } from "react-dom";
import styles from "@/app/login/page.module.css";

export function LoginSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className={styles.button} type="submit" disabled={pending} aria-busy={pending}>
      {pending ? "登录中..." : "登录"}
    </button>
  );
}
