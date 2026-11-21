"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import styles from "./NewsletterSignup.module.css";

export type NewsletterSignupProps = {
  heading?: string;
  description?: string;
  placeholder?: string;
  buttonLabel?: string;
  nameField?: boolean;
  tags?: string;
  source?: string;
  align?: "left" | "center";
};

/** Inline newsletter sign-up. Posts to the CMS via the origin-safe proxy. */
export function NewsletterSignup({
  heading = "Subscribe to our newsletter",
  description = "Get product updates and insights in your inbox.",
  placeholder = "you@company.com",
  buttonLabel = "Subscribe",
  nameField = false,
  tags = "",
  source = "website",
  align = "left",
}: NewsletterSignupProps) {
  const [status, setStatus] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const startedAt = useRef(0);
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setStatus("busy");
    setMessage("");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: String(data.get("email") || ""),
          name: String(data.get("name") || ""),
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
          source,
          startedAt: startedAt.current,
          website: data.get("website") ?? "",
        }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.message || "Something went wrong. Please try again.");
      setMessage(result.message || "Thanks for subscribing!");
      setStatus("done");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Something went wrong.");
      setStatus("error");
    }
  };

  return (
    <div className={`${styles.wrap} ${align === "center" ? styles.center : ""}`}>
      {heading ? <h3 className={styles.heading}>{heading}</h3> : null}
      {description ? <p className={styles.description}>{description}</p> : null}
      {status === "done" ? (
        <p className={styles.success} role="status">{message}</p>
      ) : (
        <form className={styles.form} onSubmit={submit} noValidate>
          {nameField ? <input type="text" name="name" placeholder="Your name" className={styles.input} autoComplete="name" /> : null}
          <input type="email" name="email" placeholder={placeholder} required className={styles.input} autoComplete="email" />
          <input type="text" name="website" tabIndex={-1} autoComplete="off" className={styles.honeypot} aria-hidden="true" />
          <button type="submit" className={styles.button} disabled={status === "busy"}>
            {status === "busy" ? "Subscribing…" : buttonLabel}
          </button>
          {status === "error" ? <p className={styles.error} role="alert">{message}</p> : null}
        </form>
      )}
    </div>
  );
}
