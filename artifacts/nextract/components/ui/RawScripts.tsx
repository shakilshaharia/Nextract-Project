"use client";

import { useEffect, useRef } from "react";

/**
 * Injects admin-provided custom HTML/JS (Settings → header/footer scripts) and
 * re-creates any <script> tags so the browser actually executes them — a plain
 * dangerouslySetInnerHTML would insert scripts without running them.
 */
export function RawScripts({ html }: { html?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host || !html) return;
    host.innerHTML = html;
    host.querySelectorAll("script").forEach((original) => {
      const script = document.createElement("script");
      for (const attr of Array.from(original.attributes)) script.setAttribute(attr.name, attr.value);
      script.text = original.textContent ?? "";
      original.replaceWith(script);
    });
    return () => {
      host.innerHTML = "";
    };
  }, [html]);

  if (!html) return null;
  return <div ref={ref} style={{ display: "contents" }} />;
}
