"use client";

import Image from "next/image";
import { useRef, useState, type KeyboardEvent } from "react";
import { LottiePlayer } from "@/components/ui/LottiePlayer";
import { SectionMedia } from "@/components/ui/SectionMedia";
import { workflow } from "@/lib/content";
import styles from "./WorkflowTabs.module.css";

/**
 * Figma "Carousel/*" components: a pill tab bar above a row of five slots.
 * The active step expands into the full card; the other slots stay as narrow cards.
 * Clicking a narrow card opens that step (prototype: Smart Animate, 300ms ease-in-out).
 */
export function WorkflowTabs({ content = workflow }: { content?: typeof workflow }) {
  const { steps, panels } = content;
  const [activePanel, setActivePanel] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const activeStep = steps.findIndex((step) => step.panel === activePanel);

  const selectStep = (index: number, focus = false) => {
    setActivePanel(steps[index].panel);
    if (focus) tabRefs.current[index]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = steps.length - 1;
    const next =
      event.key === "ArrowRight"
        ? index === last ? 0 : index + 1
        : event.key === "ArrowLeft"
          ? index === 0 ? last : index - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    selectStep(next, true);
  };

  return (
    <div className={styles.carousel}>
      <div className={styles.tabbar}>
        <div role="tablist" aria-label="Workflow steps" className={styles.tablist}>
          {steps.map((step, index) => {
            const selected = index === activeStep;
            return (
              <div key={step.id} className={styles.tabSlot}>
                {index > 0 ? <span className={styles.separator} aria-hidden="true" /> : null}
                <button
                  ref={(node) => {
                    tabRefs.current[index] = node;
                  }}
                  type="button"
                  role="tab"
                  id={`workflow-tab-${step.id}`}
                  aria-selected={selected}
                  aria-controls={`workflow-panel-${step.panel}`}
                  tabIndex={selected ? 0 : -1}
                  className={styles.tab}
                  onClick={() => selectStep(index)}
                  onKeyDown={(event) => onKeyDown(event, index)}
                >
                  <Image src={step.icon} alt="" width={24} height={24} unoptimized />
                  {step.label}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.slots}>
        {steps.map((step, slot) => {
          const panel = slot < panels.length ? panels[slot] : null;
          const active = panel !== null && slot === activePanel;
          const owner = steps.find((s) => s.panel === slot) ?? step;

          return (
            <div
              key={step.id}
              className={styles.slot}
              data-active={active}
              onClick={active ? undefined : () => selectStep(slot)}
            >
              {panel ? (
                <div
                  role="tabpanel"
                  id={`workflow-panel-${slot}`}
                  aria-labelledby={`workflow-tab-${owner.id}`}
                  aria-hidden={!active}
                  inert={!active}
                  className={styles.panel}
                >
                  <div className={styles.panelCopy}>
                    <Image
                      className={styles.tile}
                      src={panel.icon}
                      alt=""
                      width={72}
                      height={72}
                      quality={90}
                      unoptimized
                    />
                    <div className={styles.panelText}>
                      <div className={styles.panelIntro}>
                        <h3 className={`display ${styles.panelTitle}`}>{panel.title}</h3>
                        <p className={styles.panelDescription}>{panel.description}</p>
                      </div>
                      <p className={styles.impact}>
                        <span className={styles.impactLabel}>Impact: </span>
                        {panel.impact}
                      </p>
                    </div>
                  </div>
                  <SectionMedia value={panel.media} className={styles.illustration}><LottiePlayer
                    className={styles.illustration}
                    src={panel.animation}
                    ariaLabel={panel.illustrationAlt}
                  /></SectionMedia>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
