import { stats } from "@/lib/content";
import styles from "./Stats.module.css";

export function Stats({ items = stats }: { items?: Array<{ value: string; label: string }> }) {
  return (
    <section className={styles.section} aria-label="Results">
      <dl className={styles.card}>
        {items.map((stat) => (
          <div key={stat.value} className={styles.item}>
            <dt className={styles.label}>{stat.label}</dt>
            <dd className={`display ${styles.value}`}>{stat.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
