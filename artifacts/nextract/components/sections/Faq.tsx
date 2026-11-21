"use client";

import Image from "next/image";
import { useState } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { faq } from "@/lib/content";
import { sectionIds } from "@/lib/site";
import styles from "./Faq.module.css";

export function Faq({ content = faq }: { content?: typeof faq }) {
  const firstAnswerable = content.items.findIndex((item) => item.answer);
  const [openIndex, setOpenIndex] = useState(firstAnswerable);

  return (
    <section id={sectionIds.faq} className={styles.section} aria-labelledby="faq-title">
      <div className={styles.inner}>
        <div className={styles.intro}>
          <h2 id="faq-title" className={`display ${styles.title}`}>
            {content.title}
          </h2>
          <div className={styles.help}>
            <div className={styles.helpText}>
              <p className={styles.subtitle}>{content.subtitle}</p>
              <p className={styles.description}>{content.description}</p>
            </div>
            <ButtonLink href={content.cta.href} variant="secondary">
              {content.cta.label}
            </ButtonLink>
          </div>
        </div>

        <div className={styles.list}>
          {content.items.map((item, index) => {
            const isOpen = openIndex === index;

            // No answer exists in the design file yet; shown as a closed item without a toggle.
            if (!item.answer) {
              return (
                <div key={item.question} className={styles.item}>
                  <div className={styles.question}>
                    <h3 className={styles.questionText}>{item.question}</h3>
                    <span className={styles.icon} aria-hidden="true">
                      <Image src="/images/icons/plus.svg" alt="" width={24} height={24} />
                    </span>
                  </div>
                </div>
              );
            }

            const answerId = `faq-answer-${index}`;
            return (
              <div key={item.question} className={styles.item} data-open={isOpen}>
                <button
                  type="button"
                  className={styles.question}
                  aria-expanded={isOpen}
                  aria-controls={answerId}
                  onClick={() => setOpenIndex(isOpen ? -1 : index)}
                >
                  <h3 className={styles.questionText}>{item.question}</h3>
                  <span className={styles.icon} aria-hidden="true">
                    <Image className={styles.plus} src="/images/icons/plus.svg" alt="" width={24} height={24} />
                    <Image className={styles.minus} src="/images/icons/minus.svg" alt="" width={24} height={24} />
                  </span>
                </button>
                <div id={answerId} className={styles.answerWrap} role="region">
                  <div className={styles.answerInner}>
                    <p className={styles.answer}>{item.answer}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
