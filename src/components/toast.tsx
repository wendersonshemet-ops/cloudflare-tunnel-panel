"use client";

import { createContext, ReactNode, useCallback, useContext, useRef, useState } from "react";
import styles from "./toast.module.css";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastCtx {
  toast: (message: string, type?: ToastType) => void;
}

const Ctx = createContext<ToastCtx>({ toast: () => {} });

export function useToast() {
  return useContext(Ctx);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = ++counter.current;
    setItems((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className={styles.container} aria-live="polite" aria-atomic="true">
        {items.map((item) => (
          <div key={item.id} className={`${styles.toast} ${styles[item.type]}`} role="status">
            <span className={styles.icon}>
              {item.type === "success" ? "✓" : item.type === "error" ? "✕" : "ℹ"}
            </span>
            <span>{item.message}</span>
            <button className={styles.close} type="button" aria-label="关闭通知" onClick={() => setItems((p) => p.filter((t) => t.id !== item.id))}>×</button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
