"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Provider } from "../lib/schemas";
import styles from "./VendorManager.module.css";

type FormState = {
  name: string;
  category: string;
  location: string;
  phone: string;
  languages: string;
  consentedToLiveContact: boolean;
};

const EMPTY_FORM: FormState = {
  name: "",
  category: "",
  location: "Lagos",
  phone: "",
  languages: "English",
  consentedToLiveContact: false
};

export function VendorManager() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [lastAddedName, setLastAddedName] = useState<string | null>(null);
  const [message, setMessage] = useState<
    { type: "success" | "error"; text: string } | null
  >(null);

  useEffect(() => {
    void refreshProviders();
  }, []);

  async function refreshProviders() {
    setLoadingProviders(true);
    try {
      const response = await fetch("/api/providers", { cache: "no-store" });
      const result = await response.json().catch(() => null);
      if (response.ok && Array.isArray(result?.data)) {
        setProviders(result.data);
      }
    } finally {
      setLoadingProviders(false);
    }
  }

  const languages = useMemo(
    () =>
      form.languages
        .split(",")
        .map((language) => language.trim())
        .filter(Boolean),
    [form.languages]
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setMessage(null);
    setLastAddedName(null);

    try {
      const response = await fetch("/api/providers", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          name: form.name,
          category: form.category,
          location: form.location,
          phone: form.phone,
          languages,
          consentedToLiveContact: form.consentedToLiveContact
        })
      });
      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.data?.id) {
        throw new Error(
          result?.error === "INVALID_PROVIDER_INPUT"
            ? "Check the vendor details, phone number and consent confirmation."
            : "SABI could not add this vendor right now."
        );
      }

      setForm(EMPTY_FORM);
      setLastAddedName(result.data.name);
      setMessage({
        type: "success",
        text: `${result.data.name} is live-ready. SABI can now discover and call this provider in matching live missions.`
      });
      await refreshProviders();
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "SABI could not add this vendor right now."
      });
    } finally {
      setSubmitting(false);
    }
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setMessage(null);
    setLastAddedName(null);
  }

  return (
    <div className={styles.layout}>
      <section className={styles.card}>
        <div className={styles.cardHeading}>
          <div>
            <span className={styles.kicker}>LIVE PROVIDER ONBOARDING</span>
            <h2>Add a real provider</h2>
          </div>
          <span className={styles.livePill}>Real calls enabled</span>
        </div>

        <p className={styles.cardIntro}>
          Anyone can join. Add your business or a provider who has agreed to receive SABI calls. Once saved, SABI can
          discover and contact them when a matching live mission runs.
        </p>

        <div className={styles.liveFlow} aria-label="Live vendor demo flow">
          <div className={styles.flowStep}>
            <span>1</span>
            <strong>Add provider</strong>
          </div>
          <div className={styles.flowLine} aria-hidden="true" />
          <div className={styles.flowStep}>
            <span>2</span>
            <strong>Start mission</strong>
          </div>
          <div className={styles.flowLine} aria-hidden="true" />
          <div className={styles.flowStep}>
            <span>3</span>
            <strong>SABI calls</strong>
          </div>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.grid}>
            <div className={styles.field}>
              <label htmlFor="vendor-name">Business or vendor name</label>
              <input
                id="vendor-name"
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                placeholder="e.g. Scent by Lara"
                required
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="vendor-category">Category</label>
              <input
                id="vendor-category"
                value={form.category}
                onChange={(event) => updateField("category", event.target.value)}
                placeholder="e.g. Perfume"
                required
              />
            </div>
          </div>

          <div className={styles.grid}>
            <div className={styles.field}>
              <label htmlFor="vendor-location">Location</label>
              <input
                id="vendor-location"
                value={form.location}
                onChange={(event) => updateField("location", event.target.value)}
                placeholder="Lagos"
                required
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="vendor-phone">Phone number</label>
              <input
                id="vendor-phone"
                value={form.phone}
                onChange={(event) => updateField("phone", event.target.value)}
                placeholder="08012345678 or +234…"
                inputMode="tel"
                required
              />
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="vendor-languages">Languages</label>
            <input
              id="vendor-languages"
              value={form.languages}
              onChange={(event) => updateField("languages", event.target.value)}
              placeholder="English, Yoruba"
              required
            />
          </div>

          <label className={styles.consent}>
            <input
              type="checkbox"
              checked={form.consentedToLiveContact}
              onChange={(event) =>
                updateField("consentedToLiveContact", event.target.checked)
              }
              required
            />
            <span>
              I confirm I own this number or have the owner’s permission for SABI to call it
              during matching live missions.
            </span>
          </label>

          <button
            type="submit"
            className={styles.submit}
            disabled={
              submitting ||
              !form.name.trim() ||
              !form.category.trim() ||
              !form.location.trim() ||
              !form.phone.trim() ||
              languages.length === 0 ||
              !form.consentedToLiveContact
            }
          >
            {submitting ? <span className={styles.spinner} /> : null}
            {submitting ? "Adding to live network…" : "Add to live network"}
          </button>

          {message ? (
            message.type === "success" ? (
              <div className={`${styles.message} ${styles.success} ${styles.successPanel}`}>
                <div>
                  <strong>{lastAddedName ?? "Vendor"} is live-ready</strong>
                  <span>{message.text}</span>
                </div>
                <div className={styles.successActions}>
                  <a href="/" className={styles.primaryAction}>
                    Start a live mission
                  </a>
                  <button
                    type="button"
                    className={styles.secondaryAction}
                    onClick={() => {
                      setMessage(null);
                      setLastAddedName(null);
                    }}
                  >
                    Add another
                  </button>
                </div>
              </div>
            ) : (
              <p className={`${styles.message} ${styles.error}`}>{message.text}</p>
            )
          ) : null}
        </form>
      </section>

      <aside className={styles.directory}>
        <div className={styles.directoryHeader}>
          <span className={styles.kicker}>REAL PROVIDERS</span>
          <h2>Live provider network</h2>
          <p>
            Consenting providers SABI can discover and contact in live missions.
            Phone numbers stay private on the server.
          </p>
        </div>

        <div className={styles.vendorList}>
          {loadingProviders ? (
            <div className={styles.empty}>Loading live providers…</div>
          ) : providers.length === 0 ? (
            <div className={styles.empty}>
              No live vendors yet. Add someone on the left and they will become
              available to SABI for matching missions.
            </div>
          ) : (
            providers.map((provider) => (
              <div className={styles.vendor} key={provider.id}>
                <div className={styles.avatar} aria-hidden="true">
                  {provider.name.slice(0, 1).toUpperCase()}
                </div>
                <div className={styles.vendorMeta}>
                  <strong>{provider.name}</strong>
                  <span>
                    {provider.category} · {provider.location}
                  </span>
                  <small>{provider.languages.join(" · ")}</small>
                </div>
                <span className={styles.activeBadge}>Live-ready</span>
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}
