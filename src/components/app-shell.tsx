"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { Cloud, FolderKanban, LayoutDashboard, Logs, Menu, Settings2, Waypoints, X } from "lucide-react";
import { LogoutButton } from "@/components/logout-button";
import { ToastProvider } from "@/components/toast";
import styles from "./app-shell.module.css";

const navItems = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/services", label: "Services", icon: FolderKanban },
  { href: "/bindings", label: "Bindings", icon: Waypoints },
  { href: "/logs", label: "Logs", icon: Logs },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const currentLabel =
    navItems.find((item) => (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)))?.label ?? "Console";

  useEffect(() => {
    if (!mobileOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    }

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileOpen]);

  return (
    <ToastProvider>
      <div className={styles.shell}>
        <header className={styles.mobileHeader}>
          <div className={styles.mobileBrand}>
            <div className={styles.logo}><Cloud size={18} /></div>
            <div>
              <strong>CTP</strong>
              <p>{currentLabel}</p>
            </div>
          </div>
          <button
            type="button"
            className={styles.mobileMenuButton}
            onClick={() => setMobileOpen((value) => !value)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            aria-controls="app-navigation"
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </header>

        <aside
          className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ""}`}
          aria-label="Primary navigation"
          id="app-navigation"
        >
          <div className={styles.brand}>
            <div className={styles.logo}><Cloud size={18} /></div>
            <div>
              <strong>Cloudflare Tunnel Panel</strong>
              <p>DNS, tunnels, and origin bindings</p>
            </div>
          </div>
          <div className={styles.sidebarIntro}>
            <span className={styles.sidebarEyebrow}>CTP</span>
          </div>
          <nav className={styles.nav} aria-label="Console navigation">
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`${styles.navItem} ${active ? styles.navItemActive : ""}`}
                  onClick={() => setMobileOpen(false)}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon size={16} />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>
          <div className={styles.footerActions}>
            <LogoutButton />
          </div>
        </aside>

        {mobileOpen ? (
          <button
            type="button"
            className={styles.backdrop}
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
        ) : null}
        <main className={styles.content}>
          <div className={styles.contentInner}>{children}</div>
        </main>
      </div>
    </ToastProvider>
  );
}
