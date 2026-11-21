"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import type { CmsDemo } from "@/lib/cms";
import { Button } from "./Button";
import styles from "./DemoModal.module.css";

type DemoModalProps = {
  open: boolean;
  onClose: () => void;
  demo?: CmsDemo;
};

export function DemoModal({ open, onClose, demo }: DemoModalProps) {
  const interests = demo?.interests?.filter(Boolean) ?? [];
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const startedAt = useRef(0);
  // Each time the modal opens, start from a clean form (React's "adjust state
  // when a prop changes" pattern, instead of a setState-in-effect).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setSubmitted(false);
      setError("");
    }
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/forms/demo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"), email: data.get("email"), company: data.get("company"),
          interest: (data.get("interest") as string) || "Website demo", message: data.get("message"), startedAt: startedAt.current, website: "",
        }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.message || "We couldn't send your request. Please try again.");
      }
      setSubmitted(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We couldn't send your request. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    startedAt.current = Date.now();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="demo-modal-title">
      <button type="button" className={styles.backdrop} aria-label="Close" onClick={onClose} />

      <div className={styles.dialog}>
        <button type="button" className={styles.close} aria-label="Close" onClick={onClose}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M4 4l10 10M14 4 4 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>

        {submitted ? (
          <div className={styles.success}>
            <span className={styles.successIcon} aria-hidden="true">
              <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                <path d="m7 13 4 4 8-8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <h2 className={styles.title}>{demo?.successTitle || "Thanks — request received"}</h2>
            <p className={styles.subtitle}>
              {demo?.successMessage || "We’ll reach out shortly to schedule your Nextract demo."}
            </p>
            <Button className={styles.submit} onClick={onClose}>
              Done
            </Button>
          </div>
        ) : (
          <>
            <div className={styles.head}>
              <h2 id="demo-modal-title" className={styles.title}>
                {demo?.title || "Book a demo"}
              </h2>
              <p className={styles.subtitle}>
                {demo?.lede || "Tell us a bit about you and we’ll set up a walkthrough."}
              </p>
            </div>

            <form className={styles.form} onSubmit={submit}>
              <label className={styles.field}>
                <span className={styles.label}>Full name *</span>
                <input className={styles.input} name="name" required placeholder="Jane Doe" />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Work email *</span>
                <input className={styles.input} name="email" type="email" required placeholder="jane@company.com" />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Company</span>
                <input className={styles.input} name="company" placeholder="Company name" />
              </label>
              {interests.length > 0 ? (
                <label className={styles.field}>
                  <span className={styles.label}>Interested in</span>
                  <select className={styles.input} name="interest" defaultValue="">
                    <option value="" disabled>Choose an option…</option>
                    {interests.map((interest) => (
                      <option key={interest} value={interest}>{interest}</option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className={styles.field}>
                <span className={styles.label}>What would you like to see?</span>
                <textarea
                  className={styles.textarea}
                  name="message"
                  rows={3}
                  placeholder="The documents or workflow you’d like us to walk through…"
                />
              </label>
              {error ? <p role="alert">{error}</p> : null}
              <Button type="submit" className={styles.submit} disabled={busy}>
                {busy ? "Sending…" : (demo?.submitLabel || "Book Demo")}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
