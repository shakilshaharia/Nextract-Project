import { PageHero } from "@/components/layout/PageHero";
import { pricingHero } from "@/lib/pricing";
import styles from "./PricingHero.module.css";

export function PricingHero({ content = pricingHero, navItems, ctaLabel, demo }: { content?: typeof pricingHero; navItems?: ReadonlyArray<{ label: string; href: string }>; ctaLabel?: string; demo?: import("@/lib/cms").CmsDemo }) {
  return (
    <PageHero navItems={navItems} ctaLabel={ctaLabel} demo={demo}>
      <div className={styles.inner}>
        <p className={styles.eyebrow}>{content.eyebrow}</p>
        <h1 className={`display ${styles.title}`}>{content.title}</h1>
        <p className={styles.subtitle}>{content.subtitle}</p>
      </div>
    </PageHero>
  );
}
