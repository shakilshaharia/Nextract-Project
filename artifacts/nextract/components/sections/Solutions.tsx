import Image from "next/image";
import { LottiePlayer } from "@/components/ui/LottiePlayer";
import { SectionMedia } from "@/components/ui/SectionMedia";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { solutions } from "@/lib/content";
import { sectionIds } from "@/lib/site";
import styles from "./Solutions.module.css";

export function Solutions({ content = solutions }: { content?: typeof solutions }) {
  const { invoices, automation, records, control } = content;

  return (
    <section id={sectionIds.solutions} className={styles.section} aria-labelledby="solutions-title">
      <div className={styles.inner}>
        <SectionHeading
          id="solutions-title"
          className={styles.heading}
          title={content.title}
          description={content.description}
          titleWidth={951}
          descriptionWidth={779}
          gap={16}
        />

        <div className={styles.grid}>
          <article className={`${styles.card} ${styles.invoiceCard}`}>
            <Image
              className={styles.invoiceBg}
              src="/images/solutions/invoice-card-gradient.png"
              alt=""
              fill
              sizes="(max-width: 1023px) 100vw, 477px"
            />
            <div className={styles.cardText}>
              <h3 className={styles.cardTitle}>{invoices.title}</h3>
              <p className={styles.cardDescription}>{invoices.description}</p>
            </div>
            <SectionMedia value={invoices.media} className={styles.invoiceStack}><LottiePlayer
              className={styles.invoiceStack}
              src="/animations/invoices.json"
              ariaLabel="Three stacked invoices: Invoice#1 and Invoice#2 approved, Invoice#3 flagged"
            /></SectionMedia>
          </article>

          <article className={`${styles.card} ${styles.darkCard} ${styles.automationCard}`}>
            <SectionMedia value={automation.media} className={styles.flowAnimation}><LottiePlayer
              className={styles.flowAnimation}
              src="/animations/match-review.json"
              ariaLabel={`${automation.label}: ${automation.steps.join(", ")}`}
            /></SectionMedia>
            <div className={styles.cardText}>
              <h3 className={styles.cardTitle}>{automation.title}</h3>
              <p className={styles.cardDescription}>{automation.description}</p>
            </div>
          </article>

          <article className={`${styles.card} ${styles.photoCard}`}>
            <SectionMedia value={records.media} className={styles.photo} cover><Image
              className={styles.photo}
              src={records.image.src || solutions.records.image.src}
              alt={records.image.alt}
              unoptimized
              fill
              sizes="(max-width: 1023px) 100vw, 779px"
            /></SectionMedia>
            <span className={styles.photoShade} aria-hidden="true" />
            <div className={styles.photoText}>
              <h3 className={styles.photoTitle}>{records.title}</h3>
              <p className={styles.photoDescription}>{records.description}</p>
            </div>
          </article>

          <article className={`${styles.card} ${styles.darkCard} ${styles.controlCard}`}>
            <div className={styles.cardText}>
              <h3 className={styles.cardTitle}>{control.title}</h3>
              <p className={styles.cardDescription}>{control.description}</p>
            </div>
            <div className={styles.statusPanel} aria-hidden="true">
              <div className={styles.statusInner}>
                <div className={styles.statusHeader}>
                  <span>{control.confidenceLabel}</span>
                  <span className={styles.badge}>
                    <span className={styles.badgeDot} />
                    {control.confidenceValue}
                  </span>
                </div>
                <ul className={styles.statusRows}>
                  {control.rows.map((row) => (
                    <li key={row.label} className={styles.statusRow} data-tone={row.tone}>
                      <span>{row.label}</span>
                      <span className={styles.statusPill}>{row.status}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
