"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { ConsentChoices } from "@workspace/cms-content";
import { useConsentChoices } from "@/components/privacy/useConsentChoices";
import styles from "./Campaigns.module.css";

type Style = { bgColor: string; textColor: string; ctaBgColor: string; ctaTextColor: string };
type Config = {
  heading: string; body: string; ctaLabel: string; ctaHref: string; ctaNewTab: boolean; dismissible: boolean;
  placement: "top" | "bottom" | "center" | "corner-br" | "corner-bl";
  trigger: "immediate" | "delay" | "scroll" | "exit"; triggerValue: number;
  frequency: "always" | "session" | "once" | "days"; frequencyDays: number;
  devices: { desktop: boolean; mobile: boolean };
  scope: "everywhere" | "specific"; paths: string[]; style: Style;
};
type Campaign = { id: string; type: "BAR" | "POPUP"; config: Config };

function matchPath(scope: string, paths: string[], pathname: string) {
  if (scope === "everywhere") return true;
  const path = pathname.replace(/\/+$/, "") || "/";
  return paths.some((p) => {
    const rule = p.trim();
    if (rule.endsWith("/*")) return path.startsWith(rule.slice(0, -2));
    return path === rule.replace(/\/+$/, "") || path === rule;
  });
}

function allowedByFrequency(id: string, freq: string, days: number, canStore: boolean) {
  if (!canStore) return true;
  try {
    const key = `camp_${id}`;
    if (freq === "always") return true;
    if (freq === "session") return !sessionStorage.getItem(key);
    const stored = localStorage.getItem(key);
    if (freq === "once") return !stored;
    if (freq === "days") return !stored || Date.now() - Number(stored) > days * 86400000;
  } catch {
    return true;
  }
  return true;
}

function markShown(id: string, freq: string, canStore: boolean) {
  if (!canStore) return;
  try {
    const key = `camp_${id}`;
    if (freq === "session") sessionStorage.setItem(key, "1");
    else if (freq !== "always") localStorage.setItem(key, String(Date.now()));
  } catch {
    /* storage unavailable */
  }
}

const track = (id: string, event: "view" | "click" | "dismiss", analyticsAllowed: boolean) => {
  if (!analyticsAllowed) return;
  fetch(`/api/public/campaigns/${id}/event`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event }), keepalive: true }).catch(() => {});
};

export function Campaigns() {
  const pathname = usePathname();
  const consent = useConsentChoices();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  useEffect(() => {
    fetch("/api/public/campaigns", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d: { items: Campaign[] }) => setCampaigns(d.items ?? []))
      .catch(() => {});
  }, []);

  if (campaigns.length === 0) return null;
  return <>{campaigns.map((c) => <CampaignItem key={c.id} campaign={c} pathname={pathname || "/"} consent={consent} />)}</>;
}

function CampaignItem({ campaign, pathname, consent }: { campaign: Campaign; pathname: string; consent: ConsentChoices | null }) {
  const { id, type, config } = campaign;
  const [visible, setVisible] = useState(false);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    const isMobile = window.matchMedia("(max-width: 640px)").matches;
    if (isMobile ? !config.devices.mobile : !config.devices.desktop) return;
    if (!matchPath(config.scope, config.paths, pathname)) return;
    if (!allowedByFrequency(id, config.frequency, config.frequencyDays, Boolean(consent?.functional))) return;

    if (type === "BAR" || config.trigger === "immediate") {
      // Deferred a tick: visibility depends on browser-only checks above.
      const t = setTimeout(() => setVisible(true), 0);
      return () => clearTimeout(t);
    }
    if (config.trigger === "delay") {
      const t = setTimeout(() => setVisible(true), (config.triggerValue || 0) * 1000);
      return () => clearTimeout(t);
    }
    if (config.trigger === "scroll") {
      const onScroll = () => {
        const max = document.body.scrollHeight - window.innerHeight;
        const pct = max > 0 ? (window.scrollY / max) * 100 : 100;
        if (pct >= (config.triggerValue || 50)) {
          setVisible(true);
          window.removeEventListener("scroll", onScroll);
        }
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      return () => window.removeEventListener("scroll", onScroll);
    }
    if (config.trigger === "exit") {
      const onLeave = (e: MouseEvent) => {
        if (e.clientY <= 0) {
          setVisible(true);
          document.removeEventListener("mouseleave", onLeave);
        }
      };
      document.addEventListener("mouseleave", onLeave);
      return () => document.removeEventListener("mouseleave", onLeave);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, type, pathname]);

  useEffect(() => {
    if (visible) {
      track(id, "view", Boolean(consent?.analytics));
      markShown(id, config.frequency, Boolean(consent?.functional));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, consent?.analytics, consent?.functional]);

  if (!visible || closed) return null;

  const close = () => { setClosed(true); track(id, "dismiss", Boolean(consent?.analytics)); };
  const s = config.style;
  const barStyle = { background: s.bgColor || undefined, color: s.textColor || undefined };
  const btnStyle = { background: s.ctaBgColor || undefined, color: s.ctaTextColor || undefined };
  const cta = config.ctaLabel ? (
    <a className={styles.cta} href={config.ctaHref || "#"} style={btnStyle} onClick={() => track(id, "click", Boolean(consent?.analytics))} {...(config.ctaNewTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      {config.ctaLabel}
    </a>
  ) : null;
  const closeBtn = config.dismissible ? (
    <button type="button" className={styles.close} aria-label="Close" onClick={close} style={{ color: s.textColor || undefined }}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
    </button>
  ) : null;

  if (type === "BAR") {
    return (
      <div className={`${styles.bar} ${config.placement === "bottom" ? styles.barBottom : styles.barTop}`} style={barStyle} role="region" aria-label="Site announcement">
        <div className={styles.barInner}>
          {config.heading ? <span className={styles.barHeading}>{config.heading}</span> : null}
          {config.body ? <span className={styles.barBody}>{config.body}</span> : null}
          {cta}
        </div>
        {closeBtn}
      </div>
    );
  }

  const corner = config.placement === "corner-br" || config.placement === "corner-bl";
  return (
    <div className={corner ? styles.cornerWrap : styles.overlay} role="dialog" aria-modal={!corner} aria-label="Announcement">
      {!corner ? <button type="button" className={styles.backdrop} aria-label="Close" onClick={config.dismissible ? close : undefined} /> : null}
      <div className={`${styles.popup} ${config.placement === "corner-bl" ? styles.cornerBl : config.placement === "corner-br" ? styles.cornerBr : styles.center}`} style={barStyle}>
        {closeBtn}
        {config.heading ? <p className={styles.popupHeading}>{config.heading}</p> : null}
        {config.body ? <p className={styles.popupBody}>{config.body}</p> : null}
        {cta}
      </div>
    </div>
  );
}
