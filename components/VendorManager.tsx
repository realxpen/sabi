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
  const [token, setToken] = useState("");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<
    { type: "success" | "error"; text: string } | null
  >(null);

  useEffect(() => {
    const saved = window.sessionStorage.getItem("sabi-operator-token");
    if (saved) setToken(saved);

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

    if (!token.trim()) {
      setMessage({
        type: "error",
        text: "Enter the operator token once for this browser session."
      });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/providers", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token.trim()}`
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
        if (response.status === 401) {
          throw new Error("That operator token was not accepted.");
        }
        throw new Error(
          result?.error === "INVALID_PROVIDER_INPUT"
            ? "Check the vendor details, phone number and consent confirmation."
            : "SABI could not add this vendor right now."
        );
      }

      window.sessionStorage.setItem("sabi-operator-token", token.trim());
      setForm(EMPTY_FORM);
      setMessage({
        type: "success",
        text: `${result.data.name} is now available to SABI for live provider discovery.`
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
  }

  return (
    <div className={styles.layout}>
      <section className={styles.card}>
        <h2>Add a vendor</h2>
        <p className={styles.cardIntro}>
          Add a consenting provider once. SABI can then discover the vendor in
          live missions without editing deployment environment JSON.
        </p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.grid}>
            <div className={styles.field}>
              <label htmlFor="vendor-name">Business or vendor name</label>
              <input
                id="vendor-name"
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                placeholder="e.g. Ayo Perfumes"
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
              I confirm this vendor has explicitly consented to be contacted by
              SABI during this live test. Adding them does not trigger a call.
            </span>
          </label>

          <div className={styles.tokenBox}>
            <div className={styles.field}>
              <label htmlFor="operator-token">Operator token</label>
              <input
                id="operator-token"
                type="password"
                value={token}
                onChange={(event) => {
                  setToken(event.target.value);
                  setMessage(null);
                }}
                placeholder="Paste once for this session"
                autoComplete="off"
                required
              />
            </div>
            <span>
              Stored only in this browser tab/session and sent only when you add
              a vendor. Vendor phone numbers are never returned in directory responses.
            </span>
          </div>

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
            {submitting ? "Adding vendor…" : "Add vendor"}
          </button>

          {message ? (
            <p
              className={`${styles.message} ${
                message.type === "success" ? styles.success : styles.error
              }`}
            >
              {message.text}
            </p>
          ) : null}
        </form>
      </section>

      <aside className={styles.directory}>
        <div className={styles.directoryHeader}>
          <h2>Live directory</h2>
          <p>
            Persisted vendors SABI can discover. Phone numbers stay private on
            the server.
          </p>
        </div>

        <div className={styles.vendorList}>
          {loadingProviders ? (
            <div className={styles.empty}>Loading vendors…</div>
          ) : providers.length === 0 ? (
            <div className={styles.empty}>
              No persisted vendors yet. Your configured test providers still
              continue to work separately.
            </div>
          ) : (
            providers.map((provider) => (
              <div className={styles.vendor} key={provider.id}>
                <div className={styles.avatar} aria-hidden="true">
                  {provider.name.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <strong>{provider.name}</strong>
                  <span>
                    {provider.category} · {provider.location}
                  </span>
                </div>
                <span className={styles.activeBadge}>Active</span>
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}
