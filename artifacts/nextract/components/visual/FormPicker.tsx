"use client";

import { useEffect, useState } from "react";

type FormOption = { slug: string; name: string };

/** Puck field: pick which custom form the Form widget embeds. */
export function FormPicker({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  const [forms, setForms] = useState<FormOption[] | null>(null);

  useEffect(() => {
    fetch("/api/admin/forms", { cache: "no-store", credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { items: FormOption[] }) => setForms(d.items ?? []))
      .catch(() => setForms([]));
  }, []);

  return (
    <div>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d4d4d8", fontSize: 13, background: "#fff" }}
      >
        <option value="">{forms === null ? "Loading forms…" : "Select a form…"}</option>
        {(forms ?? []).map((f) => (
          <option key={f.slug} value={f.slug}>{f.name} ({f.slug})</option>
        ))}
      </select>
      {forms !== null && forms.length === 0 ? (
        <p style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>No forms yet. Create one in Forms, then pick it here.</p>
      ) : null}
    </div>
  );
}
