"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { registerSection } from "@/lib/partnership";
import styles from "./RegisterSection.module.css";

export function RegisterSection({ content = registerSection }: { content?: typeof registerSection }) {
  const { eyebrow, title, text, highlights, form } = content;
  const uid = useId();
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const startedAt = useRef(0);
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
          fullName: `${data.get("first_name") || ""} ${data.get("last_name") || ""}`.trim(),
          email: data.get("email"),
          company: data.get("company"),
          inquiryType: "Partnership",
          solution: "",
          message: `Job title: ${data.get("job_title") || ""}\nPartnership interest: ${data.get("interest") || "Not specified"}`,
          startedAt: startedAt.current,
          website: "",
        }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error?.message || result.message || "We couldn't send your request. Please try again.");
      }
      setSubmitted(true);
      formElement.reset();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We couldn't send your request. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={styles.section} id="register" aria-labelledby="register-title">
      <div className={styles.inner}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h2 id="register-title" className={`display ${styles.title}`}>
            {title}
          </h2>
          <p className={styles.text}>{text}</p>
          <ul className={styles.highlights}>
            {highlights.map((h) => (
              <li key={h}>
                <span className={styles.tick} aria-hidden="true">
                  ✓
                </span>
                {h}
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.card}>
          <h3 className={styles.cardTitle}>{form.title}</h3>
          <p className={styles.cardSubtitle}>{form.subtitle}</p>

          <form onSubmit={onSubmit}>
            <div className={styles.fields}>
              <div className={styles.field}>
                <label htmlFor={`${uid}-first`}>First Name *</label>
                <input
                  id={`${uid}-first`}
                  name="first_name"
                  autoComplete="given-name"
                  required
                  suppressHydrationWarning
                />
              </div>
              <div className={styles.field}>
                <label htmlFor={`${uid}-last`}>Last Name *</label>
                <input
                  id={`${uid}-last`}
                  name="last_name"
                  autoComplete="family-name"
                  required
                  suppressHydrationWarning
                />
              </div>
              <div className={`${styles.field} ${styles.full}`}>
                <label htmlFor={`${uid}-email`}>Work Email *</label>
                <input
                  id={`${uid}-email`}
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  suppressHydrationWarning
                />
              </div>
              <div className={`${styles.field} ${styles.full}`}>
                <label htmlFor={`${uid}-job`}>Job Title *</label>
                <input
                  id={`${uid}-job`}
                  name="job_title"
                  autoComplete="organization-title"
                  required
                  suppressHydrationWarning
                />
              </div>
              <div className={`${styles.field} ${styles.full}`}>
                <label htmlFor={`${uid}-company`}>Company Name *</label>
                <input
                  id={`${uid}-company`}
                  name="company"
                  autoComplete="organization"
                  required
                  suppressHydrationWarning
                />
              </div>
              <div className={`${styles.field} ${styles.full}`}>
                <label htmlFor={`${uid}-interest`}>How Would You Like to Work With Nextract?</label>
                <select id={`${uid}-interest`} name="interest" defaultValue="">
                  <option value="" disabled>
                    Select an option
                  </option>
                  {form.interestOptions.map((opt) => (
                    <option key={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>

            <Button type="submit" elevated className={styles.submit} disabled={busy}>
              {busy ? "Sendingâ€¦" : form.submit}
              <span aria-hidden="true"> →</span>
            </Button>

            {submitted ? (
              <p className={styles.feedback} role="status">
                Thanks! Your partnership request has been sent to the Nextract team.
              </p>
            ) : null}

            {error ? <p className={styles.feedback} role="alert">{error}</p> : null}

            <p className={styles.legal}>{form.consent}</p>
          </form>
        </div>
      </div>
    </section>
  );
}
