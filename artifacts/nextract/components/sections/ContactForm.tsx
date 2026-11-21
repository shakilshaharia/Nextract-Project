"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { contact } from "@/lib/pages";
import styles from "./ContactForm.module.css";

const icons = {
  chat: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 11.5a7.5 7.5 0 1 1 3.9 6.57L4 19l.93-3.9A7.46 7.46 0 0 1 4 11.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="11.5" r="1" fill="currentColor" />
      <circle cx="12" cy="11.5" r="1" fill="currentColor" />
      <circle cx="15" cy="11.5" r="1" fill="currentColor" />
    </svg>
  ),
  location: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 21s7-5.33 7-11a7 7 0 1 0-14 0c0 5.67 7 11 7 11Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
  phone: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6.5 4h3l1.5 3.75-2 1.25a11 11 0 0 0 5 5l1.25-2L19 13.5v3a2 2 0 0 1-2.2 2A15.5 15.5 0 0 1 4 6.2 2 2 0 0 1 6.5 4Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  ),
} as const;

export function ContactForm({ content = contact }: { content?: typeof contact }) {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const startedAt = useRef(0);
  const { form, cards } = content;
  useEffect(() => { startedAt.current = Date.now(); }, []);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const formElement = event.currentTarget;
    const data = new FormData(formElement);
    try {
      const response = await fetch("/api/forms/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fullName: `${data.get("firstName") || ""} ${data.get("lastName") || ""}`.trim(),
          email: data.get("email"),
          company: data.get("company"),
          inquiryType: "Website contact",
          solution: "",
          message: `Job title: ${data.get("jobTitle") || ""}\nPhone: ${data.get("phone") || ""}\n\n${data.get("message") || ""}`,
          startedAt: startedAt.current,
          website: "",
        }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.message || "We couldn't send your message. Please try again.");
      }
      setSent(true);
      formElement.reset();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We couldn't send your message. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={styles.section} aria-label="Contact">
      <div className={styles.inner}>
        <form className={styles.card} onSubmit={onSubmit} noValidate>
          <h2 className={styles.cardTitle}>{form.heading}</h2>

          <div className={styles.grid2}>
            <input className={styles.input} name="firstName" required type="text" placeholder={form.firstName} aria-label="First name" />
            <input className={styles.input} name="lastName" required type="text" placeholder={form.lastName} aria-label="Last name" />
          </div>

          <input className={styles.input} name="email" required type="email" placeholder={form.email} aria-label="Work email" />

          <div className={styles.grid2}>
            <input
              className={styles.input}
              type="text"
              name="company"
              placeholder={form.company}
              aria-label="Company name"
              autoComplete="organization"
            />
            <input
              className={styles.input}
              type="text"
              name="jobTitle"
              placeholder={form.jobTitle}
              aria-label="Job title"
              autoComplete="organization-title"
            />
          </div>

          <input
            className={styles.input}
            type="tel"
            name="phone"
            placeholder={form.phonePlaceholder}
            aria-label="Phone number"
            suppressHydrationWarning
          />

          <textarea className={styles.textarea} name="message" required rows={3} placeholder={form.message} aria-label="Message" />

          <div className={styles.footerRow}>
            <label className={styles.consent}>
              <input type="checkbox" className={styles.checkbox} />
              <span>{form.consent}</span>
            </label>
            <button type="submit" className={styles.submit} disabled={busy}>
              {busy ? "Sendingâ€¦" : sent ? "Message Sent" : form.submit}
            </button>
          </div>
          {error ? <p role="alert">{error}</p> : null}
        </form>

        <div className={styles.cards}>
          {cards.map((card, index) => (
            <div key={index} className={styles.contactCard}>
              <span className={styles.icon}>{icons[card.icon]}</span>
              <h3 className={styles.contactTitle}>{card.title}</h3>
              <p className={styles.contactDescription}>{card.description}</p>
              <p className={styles.contactValue}>{card.value}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
