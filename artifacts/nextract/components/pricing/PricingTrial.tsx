import { ButtonLink } from "@/components/ui/Button";
import { pricingTrial } from "@/lib/pricing";
import styles from "./PricingTrial.module.css";

export function PricingTrial({ content = pricingTrial }: { content?: typeof pricingTrial }) {
  const { eyebrow, title, text, cta } = content;

  return (
    <section className={styles.section} aria-labelledby="pricing-trial-title">
      <div className={styles.inner}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h2 id="pricing-trial-title" className={`display ${styles.title}`}>
            {title}
          </h2>
          <p className={styles.text}>{text}</p>
        </div>
        <ButtonLink href={cta.href} elevated className={styles.cta}>
          {cta.label}
          <span aria-hidden="true"> →</span>
        </ButtonLink>
      </div>
    </section>
  );
}
