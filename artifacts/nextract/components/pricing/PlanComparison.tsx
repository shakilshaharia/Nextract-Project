import { planComparison } from "@/lib/pricing";
import styles from "./PlanComparison.module.css";

const cell = (value: boolean | string) =>
  typeof value === "boolean" ? (value ? "✓" : "—") : value;

export function PlanComparison({ content = planComparison }: { content?: typeof planComparison }) {
  const { eyebrow, title, subtitle, columns, rows } = content;

  return (
    <section className={styles.section} aria-labelledby="plan-compare-title">
      <div className={styles.inner}>
        <div className={styles.head}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h2 id="plan-compare-title" className={`display ${styles.title}`}>
            {title}
          </h2>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>

        <div className={styles.tableBox}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Features</th>
                {columns.map((col) => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  {row.values.map((v, i) => (
                    <td
                      key={i}
                      className={typeof v === "boolean" ? (v ? styles.yes : styles.no) : undefined}
                    >
                      {cell(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
