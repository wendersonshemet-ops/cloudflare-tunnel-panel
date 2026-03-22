"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "@/app/login/page.module.css";

export function LoginForm({ initialError = "", initialNext = "/" }: { initialError?: string; initialNext?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState(initialError);
  const [pending, setPending] = useState(false);

  const nextPath = useMemo(() => searchParams.get("next") || initialNext || "/", [searchParams, initialNext]);
  const queryPassword = useMemo(() => searchParams.get("password") || "", [searchParams]);
  const [password, setPassword] = useState(queryPassword);

  async function doLogin(inputPassword: string) {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: inputPassword }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.ok) {
      throw new Error(data?.error?.message || "Login failed.");
    }

    router.replace(nextPath || "/");
    router.refresh();
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password.trim()) {
      setError("Please enter the panel password.");
      return;
    }

    setPending(true);
    setError("");
    try {
      await doLogin(password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className={styles.card}>
      <div className={styles.header}>
        <h1>Cloudflare Tunnel Panel</h1>
        <p>Enter the panel password to continue.</p>
      </div>
      <input type="hidden" name="next" value={nextPath} />
      <label className={styles.label} htmlFor="login-password">Panel Password</label>
      <input
        id="login-password"
        className={styles.input}
        name="password"
        type="password"
        placeholder="Enter the current panel password"
        autoComplete="current-password"
        autoFocus
        required
        minLength={1}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={`login-password-hint${error ? " login-password-error" : ""}`}
      />
      <span className={styles.hint} id="login-password-hint">
        This password matches the panel access password saved in Settings.
      </span>
      {error ? (
        <p className={`${styles.message} ${styles.error}`} id="login-password-error" role="alert">
          {error}
        </p>
      ) : null}
      <button className={styles.button} type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Signing in..." : queryPassword ? "Sign in with prefilled password" : "Sign in"}
      </button>
    </form>
  );
}
