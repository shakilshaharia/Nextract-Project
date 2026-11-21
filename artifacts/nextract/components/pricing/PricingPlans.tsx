import { ButtonLink } from "@/components/ui/Button";
import { plans, plansNote } from "@/lib/pricing";
import styles from "./PricingPlans.module.css";

export function PricingPlans({ content = { plans, plansNote } }: { content?: { plans: typeof plans; plansNote: string } }) {
  return (
    <section className={styles.section} aria-label="Pricing plans">
      <div className={styles.inner}>
        <div className={styles.grid}>
          {content.plans.map((plan) => (
            <article
              key={plan.id}
              className={`${styles.plan} ${plan.featured ? styles.featured : ""}`}
            >
              {plan.featured && "badge" in plan ? (
                <span className={styles.badge}>{plan.badge}</span>
              ) : null}
              <h3 className={styles.name}>{plan.name}</h3>
              <p className={styles.desc}>{plan.description}</p>

              <div className={styles.price}>
                {plan.price} <small>{plan.period}</small>
              </div>
              <div className={styles.allowance}>
                <strong>{plan.allowanceValue}</strong> {plan.allowanceLabel}
                <span>{plan.allowanceNote}</span>
              </div>

              <ButtonLink
                href={plan.cta.href}
                elevated={plan.featured}
                variant={plan.featured ? "primary" : "secondary"}
                className={styles.cta}
              >
                {plan.cta.label}
              </ButtonLink>

              <ul className={styles.points}>
                {plan.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <p className={styles.note}>{content.plansNote}</p>
      </div>
    </section>
  );
}
