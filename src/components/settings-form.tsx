"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { AppSettings } from "@/lib/settings";
import styles from "./forms.module.css";

type SettingsFieldErrors = Partial<Record<keyof AppSettings | "currentPassword" | "newPassword" | "confirmPassword", string>>;

function validateSettings(
  form: AppSettings,
  passwordFields: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  },
): SettingsFieldErrors {
  const nextErrors: SettingsFieldErrors = {};

  if (!form.cloudflareApiToken.trim()) {
    nextErrors.cloudflareApiToken = "Cloudflare API token is required.";
  }

  if (!form.cloudflareAccountId.trim()) {
    nextErrors.cloudflareAccountId = "Cloudflare account ID is required.";
  } else if (/\s/.test(form.cloudflareAccountId)) {
    nextErrors.cloudflareAccountId = "Cloudflare account ID cannot contain spaces.";
  }

  const timeout = form.healthTimeoutMs.trim();
  if (!timeout) {
    nextErrors.healthTimeoutMs = "Health timeout is required.";
  } else if (!/^\d+$/.test(timeout)) {
    nextErrors.healthTimeoutMs = "Health timeout must be a number in milliseconds.";
  } else if (Number(timeout) < 100) {
    nextErrors.healthTimeoutMs = "Health timeout should be at least 100 ms.";
  }

  const { currentPassword, newPassword, confirmPassword } = passwordFields;
  const wantsPasswordChange = Boolean(currentPassword || newPassword || confirmPassword);

  if (wantsPasswordChange && !currentPassword) {
    nextErrors.currentPassword = "Current panel password is required before changing it.";
  }
  if (currentPassword && !newPassword) {
    nextErrors.newPassword = "Enter a new panel password or clear all password fields.";
  }
  if (newPassword && newPassword.length < 6) {
    nextErrors.newPassword = "New panel password must be at least 6 characters.";
  } else if (currentPassword && newPassword && currentPassword === newPassword) {
    nextErrors.newPassword = "New panel password must be different from the current one.";
  }
  if (newPassword && !confirmPassword) {
    nextErrors.confirmPassword = "Please confirm the new panel password.";
  } else if (newPassword && confirmPassword && newPassword !== confirmPassword) {
    nextErrors.confirmPassword = "The new panel passwords do not match.";
  }

  return nextErrors;
}

export function SettingsForm({ initial }: { initial: AppSettings }) {
  const router = useRouter();
  const formId = useId();
  const [form, setForm] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<SettingsFieldErrors>({});

  const isDirty =
    JSON.stringify(form) !== JSON.stringify(initial) ||
    Boolean(currentPassword || newPassword || confirmPassword);
  const liveErrors = validateSettings(form, { currentPassword, newPassword, confirmPassword });
  const hasBlockingErrors = Object.keys(liveErrors).length > 0;
  const errorEntries = Object.entries(fieldErrors).filter((entry): entry is [string, string] => Boolean(entry[1]));
  const submitLabel = loading
    ? "Saving..."
    : !isDirty
      ? "No changes"
      : hasBlockingErrors
        ? `Fix ${Object.keys(liveErrors).length} issue(s)`
        : "Save settings";

  function updateForm<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    const nextForm = { ...form, [key]: value };
    setForm(nextForm);
    setFieldErrors(validateSettings(nextForm, { currentPassword, newPassword, confirmPassword }));
    if (message) setMessage("");
  }

  function updatePasswords(next: Partial<{ currentPassword: string; newPassword: string; confirmPassword: string }>) {
    const values = {
      currentPassword: next.currentPassword ?? currentPassword,
      newPassword: next.newPassword ?? newPassword,
      confirmPassword: next.confirmPassword ?? confirmPassword,
    };

    if (typeof next.currentPassword === "string") setCurrentPassword(next.currentPassword);
    if (typeof next.newPassword === "string") setNewPassword(next.newPassword);
    if (typeof next.confirmPassword === "string") setConfirmPassword(next.confirmPassword);

    setFieldErrors(validateSettings(form, values));
    if (message) setMessage("");
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const nextErrors = validateSettings(form, { currentPassword, newPassword, confirmPassword });
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setMessageType("error");
      setMessage("Please fix the form errors before saving.");
      setLoading(false);
      return;
    }

    try {
      const payload: Record<string, unknown> = { ...form };
      if (newPassword) {
        payload.newPassword = newPassword;
      } else {
        delete payload.panelPassword;
      }

      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, currentPassword }),
      });
      const json = await res.json();
      if (!json?.ok) {
        throw new Error(json?.error?.message || "Failed to save settings.");
      }

      setMessageType("success");
      setMessage(newPassword ? "Settings and panel password saved." : "Settings saved.");
      setFieldErrors({});
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      router.refresh();
    } catch (error) {
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "Failed to save settings.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={onSubmit}>
      <section className={styles.formSection}>
        <div className={styles.sectionHeader}>
          <h3>Cloudflare API</h3>
          <p>CTP uses the Cloudflare API for tunnel ingress and DNS management in remote-docker-only mode.</p>
        </div>
        <div className={styles.row}>
          <div className={styles.field} data-invalid={Boolean(fieldErrors.cloudflareApiToken)}>
            <label htmlFor={`${formId}-token`}>
              Cloudflare API Token
              <span className={styles.required}>Required</span>
            </label>
            <input
              id={`${formId}-token`}
              value={form.cloudflareApiToken}
              onChange={(event) => updateForm("cloudflareApiToken", event.target.value)}
              placeholder="Token with DNS and Cloudflare Tunnel read/edit scopes"
              autoComplete="off"
              aria-invalid={Boolean(fieldErrors.cloudflareApiToken)}
              aria-describedby={`${formId}-token-hint${fieldErrors.cloudflareApiToken ? ` ${formId}-token-error` : ""}`}
            />
            {fieldErrors.cloudflareApiToken ? <p className={styles.fieldError} id={`${formId}-token-error`}>{fieldErrors.cloudflareApiToken}</p> : null}
            <p className={styles.fieldHint} id={`${formId}-token-hint`}>
              Required scopes: Zone read, DNS read/edit, and Cloudflare Tunnel read/edit.
            </p>
          </div>
          <div className={styles.field} data-invalid={Boolean(fieldErrors.cloudflareAccountId)}>
            <label htmlFor={`${formId}-account`}>
              Cloudflare Account ID
              <span className={styles.required}>Required</span>
            </label>
            <input
              id={`${formId}-account`}
              value={form.cloudflareAccountId}
              onChange={(event) => updateForm("cloudflareAccountId", event.target.value)}
              placeholder="32-character Cloudflare account ID"
              aria-invalid={Boolean(fieldErrors.cloudflareAccountId)}
              aria-describedby={`${formId}-account-hint${fieldErrors.cloudflareAccountId ? ` ${formId}-account-error` : ""}`}
            />
            {fieldErrors.cloudflareAccountId ? <p className={styles.fieldError} id={`${formId}-account-error`}>{fieldErrors.cloudflareAccountId}</p> : null}
            <p className={styles.fieldHint} id={`${formId}-account-hint`}>
              This is the account that owns the tunnels managed by the panel.
            </p>
          </div>
        </div>
      </section>

      <section className={styles.formSection}>
        <div className={styles.sectionHeader}>
          <h3>Runtime Behavior</h3>
          <p>CTP does not manage the cloudflared container lifecycle. It only publishes ingress remotely and checks service health from the host network.</p>
        </div>
        <div className={styles.row}>
          <div className={styles.field} data-invalid={Boolean(fieldErrors.healthTimeoutMs)}>
            <label htmlFor={`${formId}-timeout`}>
              Health Timeout (ms)
              <span className={styles.required}>Required</span>
            </label>
            <input
              id={`${formId}-timeout`}
              value={form.healthTimeoutMs}
              onChange={(event) => updateForm("healthTimeoutMs", event.target.value)}
              placeholder="3000"
              inputMode="numeric"
              aria-invalid={Boolean(fieldErrors.healthTimeoutMs)}
              aria-describedby={`${formId}-timeout-hint${fieldErrors.healthTimeoutMs ? ` ${formId}-timeout-error` : ""}`}
            />
            {fieldErrors.healthTimeoutMs ? <p className={styles.fieldError} id={`${formId}-timeout-error`}>{fieldErrors.healthTimeoutMs}</p> : null}
            <p className={styles.fieldHint} id={`${formId}-timeout-hint`}>
              Used for local origin checks and public reachability checks.
            </p>
          </div>
          <div className={styles.field}>
            <label htmlFor={`${formId}-strategy`}>
              Tunnel Selection Strategy
              <span className={styles.required}>Required</span>
            </label>
            <select
              id={`${formId}-strategy`}
              value={form.tunnelSelectionStrategy}
              onChange={(event) => updateForm("tunnelSelectionStrategy", event.target.value as AppSettings["tunnelSelectionStrategy"])}
              aria-describedby={`${formId}-strategy-hint`}
            >
              <option value="manual">Manual</option>
              <option value="first-available">First available</option>
              <option value="least-bindings">Least bindings</option>
              <option value="zone-affinity">Zone affinity</option>
            </select>
            <p className={styles.fieldHint} id={`${formId}-strategy-hint`}>
              Controls the default tunnel recommendation when creating new bindings.
            </p>
          </div>
        </div>
      </section>

      <section className={styles.formSection}>
        <div className={styles.sectionHeader}>
          <h3>Service Discovery</h3>
          <p>Optional discovery can still import candidate services, but cloudflared itself remains externally managed.</p>
        </div>
        <div className={styles.row}>
          <div className={styles.field}>
            <label htmlFor={`${formId}-docker-discovery`}>
              Docker Discovery
              <span className={styles.required}>Required</span>
            </label>
            <select
              id={`${formId}-docker-discovery`}
              value={form.serviceDiscoveryDockerEnabled}
              onChange={(event) => updateForm("serviceDiscoveryDockerEnabled", event.target.value)}
              aria-describedby={`${formId}-docker-discovery-hint`}
            >
              <option value="false">Disabled</option>
              <option value="true">Enabled</option>
            </select>
            <p className={styles.fieldHint} id={`${formId}-docker-discovery-hint`}>
              Imports candidate services from published Docker ports when available.
            </p>
          </div>
          <div className={styles.field}>
            <label htmlFor={`${formId}-systemd-discovery`}>
              Systemd Discovery
              <span className={styles.required}>Required</span>
            </label>
            <select
              id={`${formId}-systemd-discovery`}
              value={form.serviceDiscoverySystemdEnabled}
              onChange={(event) => updateForm("serviceDiscoverySystemdEnabled", event.target.value)}
              aria-describedby={`${formId}-systemd-discovery-hint`}
            >
              <option value="false">Disabled</option>
              <option value="true">Enabled</option>
            </select>
            <p className={styles.fieldHint} id={`${formId}-systemd-discovery-hint`}>
              Keeps optional host service discovery, but CTP no longer controls cloudflared through systemd.
            </p>
          </div>
        </div>
      </section>

      <section className={styles.formSection}>
        <div className={styles.sectionHeader}>
          <h3>Panel Password</h3>
          <p>Only fill in these fields when you want to rotate the panel password.</p>
        </div>
        <div className={styles.row}>
          <div className={styles.field} data-invalid={Boolean(fieldErrors.currentPassword)}>
            <label htmlFor={`${formId}-current-password`}>Current Panel Password</label>
            <input
              id={`${formId}-current-password`}
              type="password"
              value={currentPassword}
              onChange={(event) => updatePasswords({ currentPassword: event.target.value })}
              placeholder="Required only when changing the password"
              autoComplete="current-password"
              aria-invalid={Boolean(fieldErrors.currentPassword)}
              aria-describedby={`${formId}-current-password-hint${fieldErrors.currentPassword ? ` ${formId}-current-password-error` : ""}`}
            />
            {fieldErrors.currentPassword ? <p className={styles.fieldError} id={`${formId}-current-password-error`}>{fieldErrors.currentPassword}</p> : null}
            <p className={styles.fieldHint} id={`${formId}-current-password-hint`}>
              This prevents accidental password changes.
            </p>
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.field} data-invalid={Boolean(fieldErrors.newPassword)}>
            <label htmlFor={`${formId}-new-password`}>New Panel Password</label>
            <input
              id={`${formId}-new-password`}
              type="password"
              value={newPassword}
              onChange={(event) => updatePasswords({ newPassword: event.target.value })}
              placeholder="At least 6 characters"
              autoComplete="new-password"
              aria-invalid={Boolean(fieldErrors.newPassword)}
              aria-describedby={`${formId}-new-password-hint${fieldErrors.newPassword ? ` ${formId}-new-password-error` : ""}`}
            />
            {fieldErrors.newPassword ? <p className={styles.fieldError} id={`${formId}-new-password-error`}>{fieldErrors.newPassword}</p> : null}
            <p className={styles.fieldHint} id={`${formId}-new-password-hint`}>
              Leave blank if you are not changing the panel password.
            </p>
          </div>
          <div className={styles.field} data-invalid={Boolean(fieldErrors.confirmPassword)}>
            <label htmlFor={`${formId}-confirm-password`}>Confirm New Password</label>
            <input
              id={`${formId}-confirm-password`}
              type="password"
              value={confirmPassword}
              onChange={(event) => updatePasswords({ confirmPassword: event.target.value })}
              placeholder="Repeat the new password"
              autoComplete="new-password"
              aria-invalid={Boolean(fieldErrors.confirmPassword)}
              aria-describedby={`${formId}-confirm-password-hint${fieldErrors.confirmPassword ? ` ${formId}-confirm-password-error` : ""}`}
            />
            {fieldErrors.confirmPassword ? <p className={styles.fieldError} id={`${formId}-confirm-password-error`}>{fieldErrors.confirmPassword}</p> : null}
            <p className={styles.fieldHint} id={`${formId}-confirm-password-hint`}>
              The new password is only stored when both entries match.
            </p>
          </div>
        </div>
      </section>

      <p className={`${styles.helper} ${styles.helperCard}`}>
        Remote-docker-only mode assumes both the panel and cloudflared run with host networking. CTP manages Cloudflare DNS and tunnel ingress, but it does not start, stop, or restart the connector container.
      </p>

      <div className={styles.formActions}>
        {errorEntries.length > 0 ? (
          <div className={styles.summary} role="alert">
            <p className={styles.summaryTitle}>{errorEntries.length} issue(s) need attention</p>
            <ul className={styles.summaryList}>
              {errorEntries.map(([key, value]) => (
                <li key={key}>{value}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {message ? (
          <p className={`${styles.message} ${messageType === "success" ? styles.success : styles.error}`} role="alert">
            {message}
          </p>
        ) : null}

        <div className={styles.fieldMeta}>
          <p className={styles.actionHint}>
            {!isDirty
              ? "No pending changes."
              : hasBlockingErrors
                ? "Fix the validation errors before saving."
                : "Saving updates the panel settings immediately for future sync and publish operations."}
          </p>
          <div className={styles.fieldMetaActions}>
            <button className={styles.button} disabled={loading || !isDirty || hasBlockingErrors} type="submit" aria-busy={loading}>
              {submitLabel}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
