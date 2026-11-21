import { partnershipFaq, pilot } from "@/lib/partnership";
import styles from "./PilotFaq.module.css";

export function PilotFaq({ pilotContent = pilot, faqContent = partnershipFaq }: { pilotContent?: typeof pilot; faqContent?: typeof partnershipFaq }) {
  return (
    <section className={styles.section} aria-label="Pilot and FAQs">
      <div className={styles.inner}>
        <div className={styles.pilot} id="pilot">
          <p className={styles.eyebrow}>{pilotContent.eyebrow}</p>
          <h2 className={`display ${styles.pilotTitle}`}>{pilotContent.title}</h2>
          <p className={styles.pilotText}>{pilotContent.text}</p>
        </div>

        <div className={styles.faq} id="faq">
          <div className={styles.faqHead}>
            <p className={styles.eyebrow}>{faqContent.eyebrow}</p>
            <h2 className={`display ${styles.faqTitle}`}>{faqContent.title}</h2>
          </div>

          <div className={styles.list}>
            {faqContent.items.map((item) => (
              <details key={item.q} className={styles.item}>
                <summary className={styles.summary}>{item.q}</summary>
                <p className={styles.answer}>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
