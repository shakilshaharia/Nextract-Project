"use client";

import Image from "next/image";
import { useState, type CSSProperties } from "react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { testimonials } from "@/lib/content";
import { sectionIds } from "@/lib/site";
import styles from "./Testimonials.module.css";

export function Testimonials({ content = testimonials }: { content?: typeof testimonials }) {
  const { items } = content;
  const [index, setIndex] = useState(0);
  const last = items.length - 1;

  return (
    <section id={sectionIds.testimonials} className={styles.section} aria-labelledby="testimonials-title">
      <div className={styles.inner}>
        <SectionHeading
          id="testimonials-title"
          title={content.title}
          description={content.description}
          titleWidth={906}
          descriptionWidth={480}
          gap={16}
          descriptionSize="md"
        />

        <div className={styles.carousel} role="region" aria-roledescription="carousel" aria-label="Testimonials">
          <div className={styles.viewport}>
            <ul className={styles.track} style={{ "--index": index } as CSSProperties} aria-live="polite">
              {items.map((item, i) => (
                <li
                  key={item.name}
                  className={styles.slide}
                  aria-roledescription="slide"
                  aria-label={`${i + 1} of ${items.length}`}
                >
                  <figure className={styles.card}>
                    <Image
                      className={styles.quoteIcon}
                      src="/images/icons/quote.svg"
                      alt=""
                      width={48}
                      height={48}
                    />
                    <blockquote className={styles.quote}>
                      <p>{item.quote}</p>
                    </blockquote>
                    <p className={styles.result}>
                      <span className={styles.stat}>{item.stat}</span>
                      <span className={styles.statDescription}>{item.statDescription}</span>
                    </p>
                    <hr className={styles.rule} />
                    <figcaption className={styles.footer}>
                      <span className={styles.author}>
                        <span className={styles.name}>{item.name}</span>
                        <span className={styles.role}>{item.role}</span>
                      </span>
                    </figcaption>
                  </figure>
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.controls}>
            <button
              type="button"
              className={styles.arrow}
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
              aria-label="Previous testimonial"
            >
              <Image className={styles.flip} src="/images/icons/arrow-next.svg" alt="" width={9} height={16} />
            </button>
            <div className={styles.dots}>
              {items.map((item, i) => (
                <button
                  key={item.name}
                  type="button"
                  className={styles.dot}
                  aria-label={`Show testimonial ${i + 1}`}
                  aria-current={i === index}
                  onClick={() => setIndex(i)}
                />
              ))}
            </div>
            <button
              type="button"
              className={styles.arrow}
              onClick={() => setIndex((i) => Math.min(last, i + 1))}
              disabled={index === last}
              aria-label="Next testimonial"
            >
              <Image src="/images/icons/arrow-next.svg" alt="" width={9} height={16} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
