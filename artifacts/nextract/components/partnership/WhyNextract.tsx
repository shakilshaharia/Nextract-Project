import Image from "next/image";
import { whyNextract } from "@/lib/partnership";
import styles from "./WhyNextract.module.css";

export function WhyNextract({ content = whyNextract }: { content?: typeof whyNextract }) {
  const { eyebrow, title, subtitle, cards, exampleLabel, exampleText } = content;

  return (
    <section className={styles.section} id="why-nextract" aria-labelledby="why-title">
      <div className={styles.inner}>
        <div className={styles.head}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h2 id="why-title" className={`display ${styles.title}`}>
            {title}
          </h2>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>

        <ul className={styles.grid}>
          {cards.map((card) => (
            <li key={card.title} className={styles.card}>
              <span className={styles.cardIcon} aria-hidden="true">
                <Image src={card.icon} alt="" width={22} height={22} />
              </span>
              <h3 className={styles.cardTitle}>{card.title}</h3>
              <p className={styles.cardText}>{card.description}</p>
            </li>
          ))}
        </ul>

        <div className={styles.example}>
          <span className={styles.exampleLabel}>{exampleLabel}</span>
          <p className={styles.exampleText}>{exampleText}</p>
        </div>
      </div>
    </section>
  );
}
