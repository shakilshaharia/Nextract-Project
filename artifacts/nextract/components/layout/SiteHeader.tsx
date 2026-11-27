"use client";

import { useEffect, useRef, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { DemoModal } from "@/components/ui/DemoModal";
import { Logo } from "@/components/ui/Logo";
import type { CmsDemo } from "@/lib/cms";
import { links, sectionIds, type NavLink } from "@/lib/site";
import styles from "./SiteHeader.module.css";

/** Primary navigation. Items with `children` render a dropdown (CSS-only, opens on hover/focus). */
const defaultNavItems: NavLink[] = [
  { label: "Services", href: `/#${sectionIds.solutions}` },
  { label: "Features", href: `/#${sectionIds.features}` },
  { label: "Pricing", href: links.pricing },
  { label: "Resources", href: links.resources },
  { label: "About", href: links.about },
];

const linkAttrs = (item: NavLink) => (item.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {});

const Caret = ({ className }: { className?: string }) => (
  <svg className={className} width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
    <path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function SiteHeader({ navItems = defaultNavItems, ctaLabel = 'Book Demo', demo }: { navItems?: ReadonlyArray<NavLink>; ctaLabel?: string; demo?: CmsDemo }) {
  const [open, setOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [demoOpen, setDemoOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      setOpenGroup(null);
      menuButton.current?.focus();
    };
    document.addEventListener("keydown", dismiss);
    return () => document.removeEventListener("keydown", dismiss);
  }, [open]);

  const close = () => setOpen(false);
  const openDemo = () => {
    setOpen(false);
    setDemoOpen(true);
  };
  // When a booking link is configured (demo mode "url"), the CTA opens it;
  // otherwise it opens the on-site demo dialog. The label is already resolved
  // (menu CTA label, else the demo label) by the caller.
  const label = ctaLabel;
  const bookingUrl = demo?.mode === "url" && demo.url ? demo.url : "";

  return (
    <header className={styles.header} data-open={open}>
      <div className={styles.bar}>
        <div className={styles.pill}>
          <a href={links.home} className={styles.logo} aria-label="Nextract home">
            <Logo />
          </a>

          <span className={styles.divider} aria-hidden="true" />

        <nav className={styles.menu} aria-label="Primary">
          <ul className={styles.menuList}>
            {navItems.map((item) => (
              <li key={item.label} className={styles.menuItem}>
                <a href={item.href} className={styles.menuLink} {...linkAttrs(item)}>
                  {item.label}
                  {item.children && item.children.length > 0 ? <Caret className={styles.caret} /> : null}
                </a>
                {item.children && item.children.length > 0 ? (
                  <ul className={styles.dropdown}>
                    {item.children.map((child) => (
                      <li key={child.label}>
                        <a href={child.href} {...linkAttrs(child)}>{child.label}</a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
          </nav>
        </div>

        <div className={styles.actions}>
          {bookingUrl ? (
            <ButtonLink size="sm" className={styles.cta} href={bookingUrl} target="_blank" rel="noopener noreferrer">
              {label}
            </ButtonLink>
          ) : (
            <Button size="sm" className={styles.cta} onClick={openDemo}>
              {label}
            </Button>
          )}
          <button
            ref={menuButton}
            type="button"
            className={styles.burger}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((value) => !value)}
          >
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
              {open ? (
                <path d="M5 5l12 12M17 5 5 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              ) : (
                <path d="M3 6h16M3 11h16M3 16h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {open ? (
        <button
          type="button"
          className={styles.backdrop}
          aria-label="Close menu"
          tabIndex={-1}
          onClick={close}
        />
      ) : null}

      {open ? (
        <nav id="mobile-menu" className={styles.mobilePanel} aria-label="Primary">
          <ul className={styles.mobileList}>
            {navItems.map((item) =>
              item.children && item.children.length > 0 ? (
                <li key={item.label} className={styles.mobileGroup}>
                  <button
                    type="button"
                    className={styles.mobileToggle}
                    aria-expanded={openGroup === item.label}
                    onClick={() => setOpenGroup((current) => (current === item.label ? null : item.label))}
                  >
                    {item.label}
                    <Caret className={styles.mobileCaret} />
                  </button>
                  {openGroup === item.label ? (
                    <ul className={styles.mobileSubList}>
                      {item.children.map((child) => (
                        <li key={child.label}>
                          <a href={child.href} className={styles.mobileLink} onClick={close} {...linkAttrs(child)}>
                            {child.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ) : (
                <li key={item.label}>
                  <a href={item.href} className={styles.mobileLink} onClick={close} {...linkAttrs(item)}>
                    {item.label}
                  </a>
                </li>
              ),
            )}
          </ul>
        </nav>
      ) : null}

      <DemoModal open={demoOpen} onClose={() => setDemoOpen(false)} demo={demo} />
    </header>
  );
}
