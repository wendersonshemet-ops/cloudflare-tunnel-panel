"use client";

import { useState } from "react";
import styles from "./forms.module.css";

export function LogoutButton() {
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    try {
      await fetch("/api/logout", { method: "POST" });
      window.location.href = "/login";
    } finally {
      setLoading(false);
    }
  }

  return (
    <button type="button" className={styles.secondaryButton} onClick={onClick} disabled={loading} aria-busy={loading}>
      {loading ? "退出中..." : "退出登录"}
    </button>
  );
}
