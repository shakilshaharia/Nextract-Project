"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { defaultPrivacySettings, type ConsentCategory, type ConsentChoices, type PrivacySettings } from "@workspace/cms-content";
import type { CmsSnippet } from "@/lib/cms";
import { RawScripts } from "@/components/ui/RawScripts";
import { Snippets } from "@/components/ui/Snippets";
import styles from "./ConsentManager.module.css";
import { consentEvent } from "./useConsentChoices";
import { openPreferencesEvent } from "./ConsentEmbed";

type ConsentInfo = {
  privacy: PrivacySettings;
  version: string;
  region: "canada" | "europe" | "global";
  consent: { choices: ConsentChoices; action: string; recordedAt: string } | null;
};
const optionalOff: ConsentChoices = { essential: true, functional: false, analytics: false, marketing: false };
const allOn: ConsentChoices = { essential: true, functional: true, analytics: true, marketing: true };
const reloadAfterFailureKey = "nextract-consent-reload-after-failure";
function clearTrackingCookies() {
  const names = document.cookie.split(";").map((part) => part.trim().split("=")[0]);
  const hostParts = window.location.hostname.split(".");
  const domains = ["", ...hostParts.slice(0, -1).map((_, index) => `; domain=.${hostParts.slice(index).join(".")}`)];
  for (const name of names) {
    if (!/^(?:_ga(?:_|$)|_gid$|_gat(?:_|$)|_gcl_|_fbp$|_fbc$)/.test(name)) continue;
    for (const domain of domains) document.cookie = `${name}=; Max-Age=0; path=/${domain}; SameSite=Lax`;
  }
}
const labels: Record<ConsentCategory, string> = {
  essential: "Essential", functional: "Functional", analytics: "Analytics", marketing: "Marketing",
};
const descriptions: Record<ConsentCategory, string> = {
  essential: "Required for security, forms, and your saved privacy choice.",
  functional: "Optional features and embedded services.",
  analytics: "Helps us understand how visitors use the site, including Google Analytics.",
  marketing: "Marketing tools, Tag Manager, and promotional integrations.",
};

export function ConsentManager({ gaId, gtmId, headerScripts, footerScripts, headerCategory, footerCategory, snippets }: {
  gaId: string; gtmId: string; headerScripts: string; footerScripts: string;
  headerCategory: ConsentCategory; footerCategory: ConsentCategory; snippets: CmsSnippet[];
}) {
  const [info, setInfo] = useState<ConsentInfo | null>(null);
  const [choices, setChoices] = useState<ConsentChoices | null>(null);
  const [draft, setDraft] = useState<ConsentChoices>(optionalOff);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const infoRef = useRef<ConsentInfo | null>(null);
  const choicesRef = useRef<ConsentChoices | null>(null);
  const dialogRef = useRef<HTMLElement>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/public/consent", { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) throw new Error("Privacy choices are temporarily unavailable.");
      const next = (await response.json()) as ConsentInfo;
      window.sessionStorage.removeItem(reloadAfterFailureKey);
      const previous = choicesRef.current;
      if (infoRef.current && infoRef.current.version !== next.version && previous && (previous.functional || previous.analytics || previous.marketing)) {
        clearTrackingCookies();
        window.location.reload();
        return;
      }
      infoRef.current = next;
      choicesRef.current = next.consent?.choices?.essential === true ? next.consent.choices : null;
      setInfo(next);
      setChoices(choicesRef.current);
      window.dispatchEvent(new window.CustomEvent(consentEvent, { detail: choicesRef.current }));
      setDraft(choicesRef.current ?? optionalOff);
      setError("");
    } catch {
      if (choicesRef.current && (choicesRef.current.functional || choicesRef.current.analytics || choicesRef.current.marketing)) {
        if (!window.sessionStorage.getItem(reloadAfterFailureKey)) {
          window.sessionStorage.setItem(reloadAfterFailureKey, "1");
          clearTrackingCookies();
          window.location.reload();
          return;
        }
      }
      infoRef.current = null;
      choicesRef.current = null;
      setInfo(null);
      setChoices(null);
      window.dispatchEvent(new window.CustomEvent(consentEvent, { detail: null }));
      setError("Privacy choices are temporarily unavailable. Optional services remain off.");
    }
  }, []);
  useEffect(() => {
    // load() only sets state after awaiting the network, never synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const refresh = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", refresh);
    const timer = window.setInterval(() => void load(), 60_000);
    return () => { document.removeEventListener("visibilitychange", refresh); window.clearInterval(timer); };
  }, [load]);
  useEffect(() => {
    const openPreferences = () => setOpen(true);
    window.addEventListener(openPreferencesEvent, openPreferences);
    return () => window.removeEventListener(openPreferencesEvent, openPreferences);
  }, []);
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); return; }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const elements = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href]'));
      if (!elements.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); previousFocus?.focus(); };
  }, [open]);

  const save = async (action: "accept_all" | "reject_optional" | "customize" | "withdraw", next: ConsentChoices) => {
    if (!info || saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/public/consent", {
        method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
        body: JSON.stringify({ version: info.version, action, choices: next }),
      });
      if (response.status === 400) {
        await load();
        throw new Error("Privacy settings changed. Review your choices and try again.");
      }
      if (!response.ok) throw new Error("Could not save your preferences. Please try again.");
      const previous = choices;
      choicesRef.current = next;
      setChoices(next);
      window.dispatchEvent(new window.CustomEvent(consentEvent, { detail: next }));
      setDraft(next);
      setOpen(false);
      // Loaded third-party code cannot be reliably unloaded from a running page.
      // A reload applies withdrawal before any optional script can execute again.
      if (previous && (previous.functional && !next.functional || previous.analytics && !next.analytics || previous.marketing && !next.marketing)) {
        clearTrackingCookies();
        window.location.reload();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save your preferences.");
    } finally {
      setSaving(false);
    }
  };

  const privacy = info?.privacy ?? defaultPrivacySettings;
  const message = info?.region === "canada" ? privacy.canadaMessage || privacy.message : info?.region === "europe" ? privacy.europeMessage || privacy.message : privacy.message;
  const appearance = { "--consent-bg": privacy.backgroundColor, "--consent-text": privacy.textColor, "--consent-button": privacy.buttonColor } as React.CSSProperties;

  // When the admin turns the cookie consent feature off, no banner is shown and
  // the previously consent-gated scripts load as if all categories were granted.
  const consentOff = info ? privacy.enabled === false : false;
  const effectiveChoices = consentOff ? allOn : choices;

  return (
    <>
      {effectiveChoices && info && (
        <>
          {effectiveChoices.analytics && gaId && <RawScripts html={`<script async src="https://www.googletagmanager.com/gtag/js?id=${gaId}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${gaId}');</script>`} />}
          {effectiveChoices.marketing && gtmId && <RawScripts html={`<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');</script>`} />}
          {effectiveChoices[headerCategory] && <RawScripts html={headerScripts} />}
          <Snippets items={snippets} choices={effectiveChoices} />
          {effectiveChoices[footerCategory] && <RawScripts html={footerScripts} />}
        </>
      )}

      {!effectiveChoices && <aside className={`${styles.banner} ${privacy.position === "top" ? styles.top : ""}`} style={appearance} aria-label="Cookie consent">
        <div className={styles.copy}>
          <h2>{privacy.title}</h2>
          <p>{message}</p>
          <div className={styles.links}><a href={privacy.privacyPolicyUrl}>Privacy policy</a><a href={privacy.cookiePolicyUrl}>Cookie policy</a></div>
          {error && <p role="alert" className={styles.error}>{error}</p>}
        </div>
        <div className={styles.actions}>
          {info ? <>
            <button disabled={saving} onClick={() => void save("accept_all", allOn)} className={styles.primary}>Accept all</button>
            <button disabled={saving} onClick={() => void save("reject_optional", optionalOff)}>Reject optional</button>
            <button disabled={saving} onClick={() => setOpen(true)}>Customize</button>
          </> : <button onClick={() => void load()}>Retry</button>}
        </div>
      </aside>}

      {choices && !consentOff && <button className={styles.manage} onClick={() => { setDraft(choices); setOpen(true); }} aria-label="Open cookie preferences">Cookie settings</button>}

      {open && <div className={styles.backdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
        <section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="consent-heading" className={styles.dialog} style={appearance}>
          <div className={styles.dialogHead}><h2 id="consent-heading">Cookie preferences</h2><button onClick={() => setOpen(false)} aria-label="Close cookie preferences">×</button></div>
          <p>Choose the optional services you allow. You can change your choices at any time.</p>
          {(["essential", "functional", "analytics", "marketing"] as ConsentCategory[]).map((category) => <label key={category} className={styles.option}>
            <span><strong>{labels[category]}</strong><small>{descriptions[category]}</small></span>
            <input type="checkbox" checked={draft[category]} disabled={category === "essential" || saving} onChange={(event) => setDraft({ ...draft, [category]: event.target.checked })} aria-label={`${labels[category]} cookies`} />
          </label>)}
          <div className={styles.links}><a href={privacy.privacyPolicyUrl}>Privacy policy</a><a href={privacy.cookiePolicyUrl}>Cookie policy</a></div>
          {error && <p role="alert" className={styles.error}>{error}</p>}
          <div className={styles.dialogActions}>
            <button disabled={saving} onClick={() => void save(choices ? "withdraw" : "reject_optional", optionalOff)}>Reject optional</button>
            <button disabled={saving} onClick={() => void save("customize", draft)} className={styles.primary}>Save choices</button>
          </div>
        </section>
      </div>}
    </>
  );
}
