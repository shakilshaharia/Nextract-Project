"use client";

import type { CSSProperties } from "react";
import { useConsentChoices } from "./useConsentChoices";

export const openPreferencesEvent = "nextract:open-consent-preferences";

export function ConsentEmbed({ src, title, className, style }: { src: string; title: string; className?: string; style?: CSSProperties }) {
  const choices = useConsentChoices();
  if (choices?.functional) {
    return <iframe className={className} src={src} title={title} style={style} allowFullScreen referrerPolicy="strict-origin-when-cross-origin" loading="lazy" />;
  }
  return <div className={className} style={{ ...style, display: "flex", alignItems: "center", justifyContent: "center", background: "#eef2f6", color: "#233247", padding: 16, textAlign: "center" }}>
    <button type="button" onClick={() => window.dispatchEvent(new window.Event(openPreferencesEvent))} style={{ cursor: "pointer", textDecoration: "underline", color: "inherit" }}>
      Enable Functional cookies to view {title.toLowerCase()}
    </button>
  </div>;
}

export function htmlWithoutEmbeds(html: string): string {
  return html.replace(/<iframe\b[^>]*>(?:[\s\S]*?)<\/iframe\s*>/gi, '<span>Enable Functional cookies in Cookie settings to view embedded content.</span>')
    .replace(/<iframe\b[^>]*\/?\s*>/gi, '<span>Enable Functional cookies in Cookie settings to view embedded content.</span>');
}

export function ConsentHtml({ html, id, className }: { html: string; id: string; className?: string }) {
  const choices = useConsentChoices();
  return <div id={id} className={className} dangerouslySetInnerHTML={{ __html: choices?.functional ? html : htmlWithoutEmbeds(html) }} />;
}
