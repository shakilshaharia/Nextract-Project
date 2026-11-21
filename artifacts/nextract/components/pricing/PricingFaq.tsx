import { pricingFaq } from "@/lib/pricing";
import styles from "./PricingFaq.module.css";

export function PricingFaq({ content = pricingFaq }: { content?: typeof pricingFaq }) {
  const { eyebrow, title, items, footnote } = content;

  return (
    <section className={styles.section} id="faq" aria-labelledby="pricing-faq-title">
      <div className={styles.inner}>
        <div className={styles.head}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h2 id="pricing-faq-title" className={`display ${styles.title}`}>
            {title}
          </h2>
        </div>

        <div className={styles.list}>
          {items.map((item) => (
            <details key={item.q} className={styles.item}>
              <summary className={styles.summary}>{item.q}</summary>
              <p className={styles.answer}>{item.a}</p>
            </details>
          ))}
        </div>

        <p className={styles.footnote}>{footnote}</p>
      </div>
    </section>
  );
}
