"use client";

import Image from "next/image";
import { useRef, useState, type KeyboardEvent } from "react";
import { LottiePlayer } from "@/components/ui/LottiePlayer";
import { SectionMedia } from "@/components/ui/SectionMedia";
import { aiAnswers } from "@/lib/content";
import styles from "./AiAnswers.module.css";

export function AiAnswers({ content = aiAnswers }: { content?: typeof aiAnswers }) {
  const { steps } = content;
  const [active, setActive] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const select = (index: number, focus = false) => {
    setActive(index);
    if (focus) tabRefs.current[index]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = steps.length - 1;
    const next =
      event.key === "ArrowDown" || event.key === "ArrowRight"
        ? index === last ? 0 : index + 1
        : event.key === "ArrowUp" || event.key === "ArrowLeft"
          ? index === 0 ? last : index - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    select(next, true);
  };

  return (
    <section className={styles.section} aria-labelledby="ai-answers-title">
      <div className={styles.inner}>
        <header className={styles.head}>
          <h2 id="ai-answers-title" className={`display ${styles.title}`}>
            {content.title}
          </h2>
          <p className={styles.lead}>
            {content.lead}
          </p>
        </header>

        <div className={styles.body}>
          <div role="tablist" aria-label="AI capabilities" className={styles.steps}>
            {steps.map((step, index) => {
              const selected = index === active;
              return (
                <button
                  key={step.id}
                  ref={(node) => {
                    tabRefs.current[index] = node;
                  }}
                  type="button"
                  role="tab"
                  id={`ai-tab-${step.id}`}
                  aria-selected={selected}
                  aria-controls="ai-panel"
                  tabIndex={selected ? 0 : -1}
                  className={styles.step}
                  onClick={() => select(index)}
                  onKeyDown={(event) => onKeyDown(event, index)}
                >
                  <span className={styles.row}>
                    <span className={styles.icon}>
                      <span className={styles.iconDots} aria-hidden="true" />
                      <Image src={step.icon} alt="" width={24} height={24} unoptimized />
                    </span>
                    <span className={`display ${styles.stepTitle}`}>{step.title}</span>
                  </span>
                  <span className={styles.stepDesc}>{step.description}</span>
                </button>
              );
            })}
          </div>

          <div
            id="ai-panel"
            role="tabpanel"
            aria-labelledby={`ai-tab-${steps[active].id}`}
            className={styles.panel}
          >
            <SectionMedia value={steps[active].media} className={styles.panelLottie}><LottiePlayer
              // Remount on step change so each animation plays from the start.
              key={steps[active].id}
              className={styles.panelLottie}
              src={steps[active].lottie}
              ariaLabel={steps[active].panelAlt}
            /></SectionMedia>
          </div>
        </div>
      </div>
    </section>
  );
}
