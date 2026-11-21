import { competitorComparison } from "@/lib/pricing";
import styles from "./CompetitorComparison.module.css";

export function CompetitorComparison({ content = competitorComparison }: { content?: typeof competitorComparison }) {
  const { eyebrow, title, subtitle, columns, rows, caveat } = content;
  // The second column (index 1) is Nextract — highlighted.
  const nextractCol = 1;

  return (
    <section className={styles.section} id="competitor-comparison" aria-labelledby="competitor-title">
      <div className={styles.inner}>
        <div className={styles.head}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h2 id="competitor-title" className={`display ${styles.title}`}>
            {title}
          </h2>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>

        <div className={styles.tableBox}>
          <table className={styles.table}>
            <thead>
              <tr>
                {columns.map((col, i) => (
                  <th key={col} className={i === nextractCol ? styles.nextract : undefined}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label}>
                  <td>
                    <strong>{row.label}</strong>
                  </td>
                  {row.values.map((v, i) => (
                    <td key={i} className={i + 1 === nextractCol ? styles.nextract : undefined}>
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className={styles.caveat}>{caveat}</p>
      </div>
    </section>
  );
}
