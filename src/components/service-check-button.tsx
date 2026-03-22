"use client";
import { useRouter } from "next/navigation";

import { useState } from "react";
import styles from "./forms.module.css";

export function ServiceCheckButton({ serviceId }: { serviceId: string }) {
  const router = useRouter();

  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    try {
      await fetch(`/api/services/${serviceId}/check`, { method: "POST" });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button type="button" className={styles.secondaryButton} onClick={onClick} disabled={loading}>
      {loading ? "检测中..." : "检测"}
    </button>
  );
}
