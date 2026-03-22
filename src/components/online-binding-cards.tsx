"use client";

import { Copy, ExternalLink } from "lucide-react";
import { useToast } from "@/components/toast";
import styles from "./online-binding-cards.module.css";

type OnlineBindingCardItem = {
  id: string;
  hostname: string;
  serviceName: string;
  internalTarget: string;
  publicUrl: string;
  tunnelName: string;
};

export function OnlineBindingCards({ items }: { items: OnlineBindingCardItem[] }) {
  const { toast } = useToast();

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast("已复制公网链接", "success");
    } catch {
      toast("复制失败，请手动复制", "error");
    }
  }

  return (
    <div className={styles.grid}>
      {items.map((item) => (
        <div key={item.id} className={styles.card}>
          <a
            href={item.publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.primaryLink}
            title={`打开 ${item.hostname}`}
          >
            <div className={styles.topRow}>
              <span className={styles.serviceName}>{item.serviceName}</span>
              <span className={styles.badge}>在线</span>
            </div>

            <div className={styles.domainBlock}>
              <strong>{item.hostname}</strong>
            </div>

            <div className={styles.addressList}>
              <div className={styles.addressItem}>
                <span className={styles.addressLabel}>公网</span>
                <span className={styles.addressValue}>{item.publicUrl}</span>
              </div>
              <div className={styles.addressItem}>
                <span className={styles.addressLabel}>内部</span>
                <span className={styles.addressValue}>{item.internalTarget}</span>
              </div>
            </div>
          </a>

          <div className={styles.actions}>
            <span className={styles.tunnelText}>{item.tunnelName || "未指定 Tunnel"}</span>
            <div className={styles.actionButtons}>
              <button
                type="button"
                className={styles.iconButton}
                onClick={() => copyUrl(item.publicUrl)}
                aria-label={`复制 ${item.hostname} 链接`}
                title="复制公网链接"
              >
                <Copy size={15} />
              </button>
              <a
                href={item.publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.iconButton}
                aria-label={`新窗口打开 ${item.hostname}`}
                title="新窗口打开"
              >
                <ExternalLink size={15} />
              </a>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
