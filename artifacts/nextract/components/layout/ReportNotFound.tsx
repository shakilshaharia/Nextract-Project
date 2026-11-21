"use client";

import { useEffect } from "react";

/** Tells the CMS 404 monitor which missing URL a visitor reached. */
export function ReportNotFound() {
  useEffect(() => {
    void fetch("/api/not-found", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: window.location.pathname, referrer: document.referrer.slice(0, 1000) }),
      keepalive: true,
    }).catch(() => {});
  }, []);
  return null;
}
