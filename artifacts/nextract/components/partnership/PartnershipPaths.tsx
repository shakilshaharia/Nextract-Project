"use client";

import { useState } from "react";
import { partnershipPaths } from "@/lib/partnership";
import styles from "./PartnershipPaths.module.css";

export function PartnershipPaths({ content = partnershipPaths }: { content?: typeof partnershipPaths }) {
  const { eyebrow, title, subtitle, tabs } = content;
  const [active, setActive] = useState<string>(tabs[0].id);

  return (
    <section className={styles.section} id="paths" aria-labelledby="paths-title">
      <div className={styles.inner}>
        <div className={styles.head}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h2 id="paths-title" className={`display ${styles.title}`}>
            {title}
          </h2>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>

        <div className={styles.tabs} role="tablist" aria-label="Partnership paths">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={active === tab.id}
              aria-controls={`panel-${tab.id}`}
              className={styles.tab}
              onClick={() => setActive(tab.id)}
            >
              <strong className={styles.tabTitle}>{tab.label}</strong>
              <span className={styles.tabSub}>{tab.sub}</span>
            </button>
          ))}
        </div>

        {tabs.map((tab) =>
          tab.id === active ? (
            <div
              key={tab.id}
              role="tabpanel"
              id={`panel-${tab.id}`}
              aria-labelledby={`tab-${tab.id}`}
              className={styles.panel}
            >
              <ol className={styles.steps}>
                {tab.steps.map((step, i) => (
                  <li key={step.num} className={styles.step}>
                    <span className={styles.stepNum}>{step.num}</span>
                    <h3 className={styles.stepTitle}>{step.title}</h3>
                    <p className={styles.stepText}>{step.text}</p>
                    {i < tab.steps.length - 1 ? (
                      <span className={styles.arrow} aria-hidden="true">
                        →
                      </span>
                    ) : null}
                  </li>
                ))}
              </ol>
              <div className={styles.outcome}>
                <strong>{tab.outcome.strong}</strong>
                <span>{tab.outcome.note}</span>
              </div>
            </div>
          ) : null,
        )}
      </div>
    </section>
  );
}
