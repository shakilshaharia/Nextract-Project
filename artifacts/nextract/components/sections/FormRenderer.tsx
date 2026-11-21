"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import styles from "./FormRenderer.module.css";
import { useConsentChoices } from "@/components/privacy/useConsentChoices";

type Option = { label: string; value: string };
type Field = {
  id: string;
  type: string;
  name: string;
  label: string;
  placeholder: string;
  help: string;
  required: boolean;
  defaultValue: string;
  options: Option[];
  width: "full" | "half";
};
type PublicForm = {
  slug: string;
  name: string;
  description: string;
  fields: Field[];
  submitLabel: string;
  successMessage: string;
  redirectUrl: string;
  requireCaptcha: boolean;
};

/** Renders and submits a custom form built in the admin Form Builder. */
export function FormRenderer({ slug }: { slug?: string }) {
  const [form, setForm] = useState<PublicForm | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "done">("loading");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const startedAt = useRef(0);
  const viewed = useRef<string | null>(null);
  const consent = useConsentChoices();

  useEffect(() => {
    if (!slug) return; // rendered as "not available" below, no state needed
    let active = true;
    fetch(`/api/public/forms/custom/${encodeURIComponent(slug)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("not found"))))
      .then((data: { form: PublicForm }) => {
        if (!active) return;
        setForm(data.form);
        setStatus("ready");
        startedAt.current = Date.now();
      })
      .catch(() => active && setStatus("missing"));
    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    if (!slug || status !== "ready" || !consent?.analytics || viewed.current === slug) return;
    viewed.current = slug;
    fetch(`/api/public/forms/custom/${encodeURIComponent(slug)}/view`, { method: "POST" }).catch(() => {});
  }, [slug, status, consent?.analytics]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form) return;
    setBusy(true);
    setErrors({});
    setFormError("");
    const data = new FormData(event.currentTarget);
    const body: Record<string, unknown> = { startedAt: startedAt.current, website: data.get("website") ?? "" };
    for (const field of form.fields) {
      body[field.name] = field.type === "checkbox" || field.type === "consent" ? (data.get(field.name) ? "yes" : "") : data.get(field.name) ?? "";
    }
    try {
      const res = await fetch(`/api/forms/custom/${encodeURIComponent(slug!)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors(result.errors ?? {});
        throw new Error(result.message || "We couldn't send your submission. Please try again.");
      }
      if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
        return;
      }
      setSuccess(result.successMessage || form.successMessage);
      setStatus("done");
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  if (!slug) return <div className={styles.notice}>This form is not available.</div>;
  if (status === "loading") return <div className={styles.form} aria-busy="true" />;
  if (status === "missing") return <div className={styles.notice}>This form is not available.</div>;
  if (status === "done") return <div className={styles.success} role="status">{success}</div>;
  if (!form) return null;

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      {form.description ? <p className={styles.description}>{form.description}</p> : null}
      <div className={styles.grid}>
        {form.fields.map((field) => (
          <FieldControl key={field.id} field={field} error={errors[field.name]} />
        ))}
      </div>
      {/* Honeypot */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className={styles.honeypot} aria-hidden="true" />
      {formError ? <p className={styles.error} role="alert">{formError}</p> : null}
      <button type="submit" className={styles.submit} disabled={busy}>
        {busy ? "Sending…" : form.submitLabel || "Submit"}
      </button>
    </form>
  );
}

function FieldControl({ field, error }: { field: Field; error?: string }) {
  if (field.type === "hidden") return <input type="hidden" name={field.name} defaultValue={field.defaultValue} />;
  const cls = field.width === "half" ? styles.half : styles.full;
  const inputType = field.type === "email" ? "email" : field.type === "phone" ? "tel" : field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "file" ? "file" : "text";

  if (field.type === "checkbox" || field.type === "consent") {
    return (
      <div className={cls}>
        <label className={styles.checkLabel}>
          <input type="checkbox" name={field.name} required={field.required} />
          <span>{field.label}{field.required ? " *" : ""}</span>
        </label>
        {field.help ? <p className={styles.help}>{field.help}</p> : null}
        {error ? <p className={styles.error}>{error}</p> : null}
      </div>
    );
  }

  return (
    <div className={cls}>
      <label className={styles.label} htmlFor={`f-${field.id}`}>{field.label}{field.required ? " *" : ""}</label>
      {field.type === "textarea" ? (
        <textarea id={`f-${field.id}`} name={field.name} rows={4} placeholder={field.placeholder} required={field.required} className={styles.input} />
      ) : field.type === "select" ? (
        <select id={`f-${field.id}`} name={field.name} required={field.required} defaultValue="" className={styles.input}>
          <option value="" disabled>{field.placeholder || "Choose…"}</option>
          {field.options.map((o, i) => <option key={i} value={o.value}>{o.label}</option>)}
        </select>
      ) : field.type === "radio" ? (
        <div className={styles.radios}>
          {field.options.map((o, i) => (
            <label key={i} className={styles.radioLabel}>
              <input type="radio" name={field.name} value={o.value} required={field.required} /> <span>{o.label}</span>
            </label>
          ))}
        </div>
      ) : (
        <input id={`f-${field.id}`} type={inputType} name={field.name} placeholder={field.placeholder} required={field.required} className={styles.input} />
      )}
      {field.help ? <p className={styles.help}>{field.help}</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}
