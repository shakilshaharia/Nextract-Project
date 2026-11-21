import Image from "next/image";
import { pricingWhy } from "@/lib/pricing";
import styles from "./PricingWhy.module.css";

export function PricingWhy({ content = pricingWhy }: { content?: typeof pricingWhy }) {
  const { eyebrow, title, subtitle, cards } = content;

  return (
    <section className={styles.section} aria-labelledby="pricing-why-title">
      <div className={styles.inner}>
        <div className={styles.head}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h2 id="pricing-why-title" className={`display ${styles.title}`}>
            {title}
          </h2>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>

        <ul className={styles.grid}>
          {cards.map((card) => (
            <li key={card.title} className={styles.card}>
              <span className={styles.icon} aria-hidden="true">
                <Image src={card.icon} alt="" width={22} height={22} />
              </span>
              <h3 className={styles.cardTitle}>{card.title}</h3>
              <p className={styles.cardText}>{card.description}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
