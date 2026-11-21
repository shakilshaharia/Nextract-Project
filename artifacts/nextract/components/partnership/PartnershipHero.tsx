import Image from "next/image";
import { PageHero } from "@/components/layout/PageHero";
import { ButtonLink } from "@/components/ui/Button";
import { partnershipHero } from "@/lib/partnership";
import styles from "./PartnershipHero.module.css";

export function PartnershipHero({ content = partnershipHero, navItems, ctaLabel, demo }: { content?: typeof partnershipHero; navItems?: ReadonlyArray<{ label: string; href: string }>; ctaLabel?: string; demo?: import("@/lib/cms").CmsDemo }) {
  const { eyebrow, titleLead, titleTrail, subtitle, offers, cta } = content;

  return (
    <PageHero navItems={navItems} ctaLabel={ctaLabel} demo={demo}>
      <div className={styles.inner}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1 className={`display ${styles.title}`}>
          {titleLead} <span className={styles.titleTrail}>{titleTrail}</span>
        </h1>
        <p className={styles.subtitle}>{subtitle}</p>

        <ul className={styles.offers}>
          {offers.map((offer) => (
            <li key={offer.value} className={styles.offer}>
              <span className={styles.offerIcon} aria-hidden="true">
                <Image src={offer.icon} alt="" width={22} height={22} />
              </span>
              <span className={styles.offerText}>
                <span className={styles.offerValue}>
                  {offer.value}
                  {"suffix" in offer && offer.suffix ? (
                    <span className={styles.offerSuffix}> {offer.suffix}</span>
                  ) : null}
                </span>
                <span className={styles.offerLabel}>{offer.label}</span>
              </span>
            </li>
          ))}
        </ul>

        <ButtonLink href={cta.href} elevated className={styles.cta}>
          {cta.label}
          <span aria-hidden="true"> →</span>
        </ButtonLink>
      </div>
    </PageHero>
  );
}
