"use client";

import { useId, useMemo, useState } from "react";
import { earningsCalculator } from "@/lib/partnership";
import styles from "./EarningsCalculator.module.css";

const usd = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const num = (value: number) => new Intl.NumberFormat("en-US").format(value);

const cell = (value: boolean | string) =>
  typeof value === "boolean" ? (value ? "✓" : "—") : value;

const DOC_MAX = 5000;

export function EarningsCalculator({ content = earningsCalculator }: { content?: typeof earningsCalculator }) {
  const { eyebrow, title, subtitle, commission, defaultTier, tiers, disclaimer, featureColumns, featureRows } = content;
  const uid = useId();
  const [tierId, setTierId] = useState<string>(defaultTier);
  const [docs, setDocs] = useState(800);
  const [clients, setClients] = useState(3);

  const tier = tiers.find((t) => t.id === tierId) ?? tiers[0];

  const result = useMemo(() => {
    const safeDocs = Math.max(0, Math.floor(docs) || 0);
    const safeClients = Math.max(1, Math.floor(clients) || 1);
    const overages = Math.max(0, safeDocs - tier.includes);
    const perClientBill = tier.base + overages * tier.extra;
    const perClientShare = perClientBill * commission;
    const monthly = perClientShare * safeClients;
    return {
      overages,
      perClientBill,
      perClientShare,
      monthly,
      annual: monthly * 12,
      fiveYear: monthly * 60,
    };
  }, [docs, clients, tier, commission]);

  return (
    <section className={styles.section} id="earnings-calculator" aria-labelledby="calc-title">
      <div className={styles.inner}>
        <div className={styles.head}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h2 id="calc-title" className={`display ${styles.title}`}>
            {title}
          </h2>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>

        <div className={styles.layout}>
          <div className={styles.controls}>
            <h3 className={styles.controlsTitle}>Build Your Estimate</h3>

            <span className={styles.label}>Client Plan</span>
            <div className={styles.tiers} role="radiogroup" aria-label="Client plan">
              {tiers.map((t) => (
                <label key={t.id} className={styles.tier}>
                  <input
                    type="radio"
                    name={`${uid}-tier`}
                    value={t.id}
                    checked={tierId === t.id}
                    onChange={() => setTierId(t.id)}
                  />
                  <span className={styles.tierBox}>
                    <strong>{t.name}</strong>
                    <small>{t.blurb}</small>
                  </span>
                </label>
              ))}
            </div>

            <div className={styles.group}>
              <label className={styles.label} htmlFor={`${uid}-docs`}>
                Documents Per Client / Month
              </label>
              <input
                id={`${uid}-docs`}
                className={styles.number}
                type="number"
                inputMode="numeric"
                min={0}
                step={50}
                value={docs}
                onChange={(e) => setDocs(Number(e.target.value))}
              />
              <input
                className={styles.slider}
                type="range"
                min={0}
                max={DOC_MAX}
                step={50}
                value={Math.min(DOC_MAX, docs)}
                aria-label="Monthly documents per client"
                onChange={(e) => setDocs(Number(e.target.value))}
              />
            </div>

            <div className={styles.group}>
              <label className={styles.label} htmlFor={`${uid}-clients`}>
                Paying Clients Referred
              </label>
              <input
                id={`${uid}-clients`}
                className={styles.number}
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={clients}
                onChange={(e) => setClients(Number(e.target.value))}
              />
            </div>

            <p className={styles.planNote}>
              Includes {num(tier.includes)} documents per client. Additional documents: {usd(tier.extra)}{" "}
              each.
            </p>
          </div>

          <div className={styles.results} aria-live="polite" aria-atomic="true">
            <span className={styles.overline}>Estimated lifetime partner earnings</span>

            <div className={styles.metrics}>
              <div className={styles.fiveYear}>
                <span>Potential 5-Year Earnings</span>
                <div className={styles.fiveNumber}>{usd(result.fiveYear)}</div>
                <small>Assumes the same clients stay subscribed and usage remains unchanged.</small>
              </div>
              <div className={styles.annual}>
                <span>Estimated Annual Revenue</span>
                <div className={styles.annualNumber}>{usd(result.annual)}</div>
              </div>
              <div className={styles.monthlyLine}>
                <span>Estimated Monthly Revenue</span>
                <strong>{usd(result.monthly)}</strong>
              </div>
            </div>

            <div className={styles.breakdown}>
              <div>
                <span>Monthly Client Subscription + Overages</span>
                <strong>{usd(result.perClientBill)}</strong>
              </div>
              <div>
                <span>15% Lifetime Share Per Client / Month</span>
                <strong>{usd(result.perClientShare)}</strong>
              </div>
              <div>
                <span>Estimated Overage Documents / Client</span>
                <strong>{num(result.overages)}</strong>
              </div>
            </div>

            <p className={styles.disclaimer}>{disclaimer}</p>
          </div>
        </div>

        <details className={styles.features}>
          <summary>Compare What&rsquo;s Included in Each Plan</summary>
          <div className={styles.featureScroll}>
            <table>
              <thead>
                <tr>
                  <th>Capabilities</th>
                  {featureColumns.map((col) => (
                    <th key={col}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {featureRows.map((row) => (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    {row.values.map((v, i) => (
                      <td key={i}>{cell(v)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </section>
  );
}
