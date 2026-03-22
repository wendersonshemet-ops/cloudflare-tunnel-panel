import { InlineSpinner } from "@/components/ui";
import styles from "./login/page.module.css";

export default function Loading() {
  return (
    <main className={styles.page}>
      <section className={styles.card} aria-live="polite" aria-busy="true">
        <div className={styles.header}>
          <h1>Cloudflare Tunnel Panel</h1>
          <p>Preparing the panel and checking your session.</p>
        </div>
        <InlineSpinner label="Loading panel..." />
      </section>
    </main>
  );
}
