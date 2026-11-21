import Image from "next/image";
import type { ReactNode } from 'react';
import { SiteHeader } from "@/components/layout/SiteHeader";
import { ButtonLink } from "@/components/ui/Button";
import { LottiePlayer } from "@/components/ui/LottiePlayer";
import { SectionMedia } from "@/components/ui/SectionMedia";
import { hero } from "@/lib/content";
import type { CmsDemo } from "@/lib/cms";
import { sectionIds, type NavLink } from "@/lib/site";
import { BrandStrip, type BrandLogo } from "./BrandStrip";
import styles from "./Hero.module.css";

/** Thin guide lines and markers drawn over the hero background (Figma "Background Elements"). */
function HeroGuides() {
  return (
    <>
      <svg
        className={styles.guides}
        width="1600"
        height="815"
        viewBox="0 0 1600 815"
        fill="none"
        aria-hidden="true"
      >
        <g fill="#1f3f5c" fillOpacity="0.07">
          <rect x="80" y="46" width="272" height="1" />
          <circle cx="352" cy="46.5" r="2.667" />
          <rect x="1248" y="46" width="277" height="1" />
          <circle cx="1248" cy="46.5" r="2.667" />
        </g>
        <rect x="830.5" y="-2" width="1" height="723" fill="#eaedf0" />
        <rect x="1189.5" y="721" width="1" height="100" fill="#1f3f5c" fillOpacity="0.08" />
        <rect x="1476.5" y="46" width="1" height="675" fill="#1f3f5c" fillOpacity="0.08" />
      </svg>
      <Image className={styles.starTop} src="/images/decor/star-36.svg" alt="" width={23} height={11} />
      <Image className={styles.starLeft} src="/images/decor/star-37.svg" alt="" width={23} height={11} />
      <Image className={styles.starRight} src="/images/decor/star-38.svg" alt="" width={24} height={12} />
    </>
  );
}

export function Hero({ content = hero, navItems, ctaLabel, editable, logos, demo }: { content?: typeof hero; navItems?: ReadonlyArray<NavLink>; ctaLabel?: string; editable?: Record<string,ReactNode>; logos?: BrandLogo[]; demo?: CmsDemo }) {
  return (
    <section id={sectionIds.top} className={styles.hero} aria-labelledby="hero-title">
      <div className={styles.backdrop} aria-hidden="true">
        <div className={styles.frame}>
          {/* Linear-dodge light beams rebuilt from Figma vector geometry */}
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
            loading="eager"
          />
          <HeroGuides />
        </div>
      </div>

      <div className={styles.inner}>
        <SiteHeader navItems={navItems} ctaLabel={ctaLabel} demo={demo} />

        <div className={styles.content}>
          <div className={styles.copy}>
            <div className={styles.textBlock}>
              <h1 id="hero-title" className={`display ${styles.title}`}>
                {editable?.titleLead ?? content.titleLead} <span className={styles.titleTrail}>{editable?.titleTrail ?? content.titleTrail}</span>
              </h1>
              <p className={styles.description}>{editable?.description ?? content.description}</p>
            </div>
            <ButtonLink href={content.cta.href} elevated>
              {editable?.['cta.label'] ?? content.cta.label}
            </ButtonLink>
          </div>

          {/* Figma "Image Container": a browser-style window with the invoice animation inside. */}
          <div className={styles.visual}>
            <div className={styles.windowBar}>
              <span className={styles.tab} />
              <span className={styles.tabSmall} />
            </div>
            <div className={styles.stage}>
              <SectionMedia value={content.media} className={styles.illustration}><LottiePlayer
                className={styles.illustration}
                src="/animations/hero.json"
                ariaLabel="An invoice is scanned and its vendor, PO number, quantity and total are extracted, with a quantity mismatch flagged"
              /></SectionMedia>
              {(!content.media || content.media.mode === "original") && <span className={styles.stageFade} />}
            </div>
          </div>
        </div>
      </div>

      <BrandStrip items={logos} />
    </section>
  );
}
