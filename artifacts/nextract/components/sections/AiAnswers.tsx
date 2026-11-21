"use client";

import Image from "next/image";
import { useRef, useState, type KeyboardEvent } from "react";
import { LottiePlayer } from "@/components/ui/LottiePlayer";
import { SectionMedia, sectionMedia } from "@/components/ui/SectionMedia";
import styles from "./AiAnswers.module.css";

/** "AI Section" from the Figma Home frame — an interactive 3-step showcase. */
export const aiAnswers = {
  title: "Go beyond extraction with Nextract AI",
  lead: "Nextract's AI doesn't just process information. It helps your team understand what's inside documents, investigate discrepancies, and find answers without manually searching through records.",
  steps: [
  {
    id: "understand",
    icon: "/images/ai/ic-understand.svg",
    title: "AI-Generated Document Summaries",
    description:
      "Turn complex documents and extracted information into concise summaries, highlighting key details without manually reviewing every field.",
    lottie: "/animations/ai-understand.json",
    media: sectionMedia,
    panelAlt:
      "A document summary with highlighted lines, one flagged in red for attention",
  },
  {
    id: "next",
    icon: "/images/ai/ic-next.svg",
    title: "AI-Powered Exception Analysis",
    description:
      "Understand why mismatches were flagged, which values differ, and what needs to be verified before taking action.",
    lottie: "/animations/ai-next.json",
    media: sectionMedia,
    panelAlt:
      "A document with AI action tags: Check Price, Date Mismatch, Qty/PO Matched, Expired and Critical Risk",
  },
  {
    id: "ask",
    icon: "/images/ai/ic-ask.svg",
    title: "Conversational AI Assistant",
    description:
      "Ask questions in natural language about your documents, matching results, exceptions, and workflow status to get clear answers in seconds.",
    lottie: "/animations/ai-ask.json",
    media: sectionMedia,
    panelAlt:
      "A chat where the AI answers a question about differences between a document and its extracted data",
  },
] as const,
};

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
