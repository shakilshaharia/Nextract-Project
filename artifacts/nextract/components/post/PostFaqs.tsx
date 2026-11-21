"use client";

import Image from "next/image";
import { useState } from "react";
import styles from "./PostFaqs.module.css";

/**
 * FAQ accordion shown below the body on blog, success-story and event pages.
 * Editors fill these in per post from the CMS; the section is hidden when empty.
 */
export function PostFaqs({ items }: { items: { question: string; answer: string }[] }) {
  // The first FAQ opens by default so the section reads as answered, not empty.
  const [openIndex, setOpenIndex] = useState(0);

  if (!items.length) return null;

  return (
    <section className={styles.section} aria-labelledby="post-faq-title">
      <h2 id="post-faq-title" className={styles.title}>
        Frequently asked questions
      </h2>
      <div className={styles.list}>
        {items.map((item, index) => {
          const isOpen = openIndex === index;
          const answerId = `post-faq-answer-${index}`;
          return (
            <div key={index} className={styles.item} data-open={isOpen}>
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
              <div id={answerId} className={styles.answerWrap} role="region" aria-labelledby={`${answerId}-q`}>
                <div className={styles.answerInner}>
                  <p className={styles.answer}>{item.answer}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
