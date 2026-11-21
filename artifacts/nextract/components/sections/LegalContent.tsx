"use client";

import { useEffect, useState } from "react";
import type { LegalPage } from "@/lib/pages";
import styles from "./LegalContent.module.css";

export function LegalContent({ page }: { page: LegalPage }) {
  const [activeId, setActiveId] = useState(page.sections[0]?.id);

  useEffect(() => {
    const ids = page.sections.map((s) => s.id);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [page.sections]);

  return (
    <section className={styles.section}>
      <div className={styles.inner}>
        <div className={styles.body}>
          {page.sections.map((section, index) => (
            <article key={section.id} id={section.id} className={styles.block}>
              <h2 className={styles.heading}>
                {page.numbered ? `${index + 1}. ` : ""}
                {section.heading}
              </h2>
              {section.paragraphs.map((paragraph, i) => (
                <p key={i} className={styles.paragraph}>
                  {paragraph}
                </p>
              ))}
              <p className={styles.pointsLabel}>{page.pointsLabel}</p>
              <ul className={styles.points}>
                {section.points.map((point, i) => (
                  <li key={i}>{point}</li>
                ))}
              </ul>
            </article>
          ))}

          {page.footnote ? (
            <div className={styles.block}>
              <h2 className={styles.heading}>{page.footnote.label}</h2>
              <p className={styles.paragraph}>{page.footnote.text}</p>
            </div>
          ) : null}
        </div>

        <aside className={styles.toc} aria-label="Table of content">
          <div className={styles.tocCard}>
            <p className={styles.tocTitle}>Table of content</p>
            <ul className={styles.tocList}>
              {page.sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className={styles.tocLink}
                    aria-current={activeId === section.id ? "true" : undefined}
                  >
                    {section.heading}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </section>
  );
}
