"use client";
import { useEffect, useState } from "react";
import type { VisualStyle } from "@workspace/cms-content";
import { request } from "./MediaField";
type PageChoice = { id: string; title: string; path: string };
export function LinkField({
  value = "",
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [pages, setPages] = useState<PageChoice[]>([]),
    [error, setError] = useState(""),
    [choice, setChoice] = useState<string>();
  const type =
    choice ??
    (value.startsWith("mailto:")
      ? "email"
      : value.startsWith("tel:")
        ? "phone"
        : value.startsWith("/")
          ? "page"
          : "web");
  useEffect(() => {
    let active = true;
    void request<{ items: PageChoice[] }>("/api/admin/pages")
      .then((r) => {
        if (active) setPages(r.items);
      })
      .catch(() => {
        if (active)
          setError("Page list unavailable. Enter a destination below.");
      });
    return () => {
      active = false;
    };
  }, []);
  const display =
    type === "email"
      ? value.replace(/^mailto:/, "")
      : type === "phone"
        ? value.replace(/^tel:/, "")
        : value;
  return (
    <div className="visual-field">
      <label>
        Button destination
        <select
          value={type}
          onChange={(e) => {
            setChoice(e.target.value);
            onChange(
              e.target.value === "page"
                ? "/"
                : e.target.value === "email"
                  ? "mailto:"
                  : e.target.value === "phone"
                    ? "tel:"
                    : "",
            );
          }}
        >
          <option value="page">Website page</option>
          <option value="web">Web address</option>
          <option value="email">Email address</option>
          <option value="phone">Phone number</option>
        </select>
      </label>
      {type === "page" && pages.length > 0 ? (
        <label>
          Choose a page
          <select value={value} onChange={(e) => onChange(e.target.value)}>
            {!pages.some((p) => p.path === value) && (
              <option value={value}>{value || "Choose a page"}</option>
            )}
            {pages.map((p) => (
              <option key={p.id} value={p.path}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label>
          {type === "email"
            ? "Email address"
            : type === "phone"
              ? "Phone number"
              : "Destination"}
          <input
            type={
              type === "email" ? "email" : type === "phone" ? "tel" : "text"
            }
            value={display}
            placeholder={
              type === "email"
                ? "hello@example.com"
                : type === "phone"
                  ? "+1 555 123 4567"
                  : "https://example.com"
            }
            onChange={(e) =>
              onChange(
                type === "email"
                  ? `mailto:${e.target.value}`
                  : type === "phone"
                    ? `tel:${e.target.value.replace(/\s/g, "")}`
                    : e.target.value,
              )
            }
          />
        </label>
      )}
      {error && <small>{error}</small>}
    </div>
  );
}
export const brandColors = [
  { name: "Nextract blue", value: "#0082fb" },
  { name: "Navy", value: "#1f3f5c" },
  { name: "Slate", value: "#6c7a89" },
  { name: "White", value: "#ffffff" },
  { name: "Soft gray", value: "#f4f5f6" },
  { name: "Dark", value: "#181818" },
];
export function ColorControl({
  value,
  onChange,
}: {
  value?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="visual-swatches">
      {brandColors.map((c) => (
        <button
          type="button"
          key={c.value}
          aria-label={c.name}
          aria-pressed={value === c.value}
          style={{ background: c.value }}
          onClick={() => onChange(c.value)}
        />
      ))}
      <button type="button" onClick={() => onChange("inherit")}>
        Reset
      </button>
    </div>
  );
}
export function StylePresets({
  value = {},
  onChange,
  layout = false,
}: {
  value: VisualStyle;
  onChange: (v: VisualStyle) => void;
  layout?: boolean;
}) {
  return (
    <div className="visual-field">
      <label>
        Spacing
        <select
          value={value.padding ?? ""}
          onChange={(e) =>
            onChange({ ...value, padding: Number(e.target.value) })
          }
        >
          <option value="" disabled>
            Original spacing
          </option>
          <option value={16}>Compact</option>
          <option value={32}>Comfortable</option>
          <option value={64}>Spacious</option>
        </select>
      </label>
      <label>
        Text size
        <select
          value={value.fontSize ?? ""}
          onChange={(e) =>
            onChange({ ...value, fontSize: Number(e.target.value) })
          }
        >
          <option value="" disabled>
            Original size
          </option>
          <option value={14}>Small</option>
          <option value={18}>Normal</option>
          <option value={28}>Large</option>
        </select>
      </label>
      <label>
        Text color
        <ColorControl
          value={value.color}
          onChange={(color) => onChange({ ...value, color })}
        />
      </label>
      <label>
        Background
        <ColorControl
          value={value.background}
          onChange={(background) => onChange({ ...value, background })}
        />
      </label>
      {layout && (
        <fieldset>
          <legend>Column layout</legend>
          <div className="visual-column-presets">
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={value.columns === n}
                onClick={() => onChange({ ...value, columns: n })}
                aria-label={`${n} columns`}
              >
                {Array.from({ length: n }, (_, i) => (
                  <span key={i} />
                ))}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      <button type="button" onClick={() => onChange({})}>
        Restore original styling
      </button>
    </div>
  );
}
export function TextList({
  value = [],
  onChange,
  allowStructure = true,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  allowStructure?: boolean;
}) {
  return (
    <div className="visual-field">
      {value.map((s, i) => (
        <div key={i} className="visual-list-row">
          <input
            aria-label={`Item ${i + 1}`}
            value={s}
            onChange={(e) =>
              onChange(value.map((v, n) => (n === i ? e.target.value : v)))
            }
          />
          {allowStructure && (
            <button
              type="button"
              aria-label={`Remove item ${i + 1}`}
              onClick={() => onChange(value.filter((_, n) => n !== i))}
            >
              Remove
            </button>
          )}
        </div>
      ))}
      {allowStructure && (
        <button type="button" onClick={() => onChange([...value, ""])}>
          Add item
        </button>
      )}
    </div>
  );
}
