import Image from "next/image";
import type { ReactNode } from "react";
import { SiteHeader } from "./SiteHeader";
import type { CmsDemo } from "@/lib/cms";
import type { NavLink } from "@/lib/site";
import styles from "./PageHero.module.css";

type PageHeroProps = {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  align?: "center" | "left";
  children?: ReactNode;
  navItems?: ReadonlyArray<NavLink>;
  ctaLabel?: string;
  demo?: CmsDemo;
  editable?: Record<string,ReactNode>;
};

/** Shared top band (background + header + optional heading) used by the inner pages. */
export function PageHero({ eyebrow, title, subtitle, align = "center", children, navItems, ctaLabel, demo, editable }: PageHeroProps) {
  return (
    <section className={styles.hero}>
      <div className={styles.backdrop} aria-hidden="true">
        <div className={styles.frame}>
          <Image
            className={styles.beams}
            src="/images/hero/light-beams.svg"
            alt=""
            width={2447}
            height={2510}
          />
          <Image
            className={styles.glow}
            src="/images/hero/glow.png"
            alt=""
            width={818}
            height={1608}
            sizes="818px"
          />
        </div>
      </div>

      <div className={styles.inner}>
        <SiteHeader navItems={navItems} ctaLabel={ctaLabel} demo={demo} />
        {title ? (
          <div className={`${styles.heading} ${align === "left" ? styles.left : ""}`}>
            {eyebrow ? <p className={styles.eyebrow}>{editable?.eyebrow ?? eyebrow}</p> : null}
            <h1 className={`display ${styles.title}`}>{editable?.title ?? title}</h1>
            {subtitle ? <p className={styles.subtitle}>{editable?.subtitle ?? subtitle}</p> : null}
          </div>
        ) : null}
        {children}
      </div>
    </section>
  );
}
