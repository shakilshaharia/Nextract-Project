import Image from "next/image";
import type { ReactNode } from 'react';
import { ButtonLink } from "@/components/ui/Button";
import { demoCta } from "@/lib/content";
import { sectionIds } from "@/lib/site";
import styles from "./DemoCta.module.css";

export function DemoCta({ content = demoCta, editable }: { content?: typeof demoCta; editable?: Record<string,ReactNode> }) {
  return (
    <section id={sectionIds.demo} className={styles.section} aria-labelledby="demo-title">
      <div className={styles.backdrop} aria-hidden="true">
        <div className={styles.frame}>
          <Image
            className={styles.beams}
            src="/images/cta/light-beams.svg"
            alt=""
            width={2447}
            height={2510}
          />
          <svg className={styles.guides} width="1600" height="889" viewBox="0 0 1600 889" fill="none">
            <g fill="#eaedf0">
              <rect x="633.5" y="0" width="1" height="656" />
              <rect x="992.5" y="383" width="1" height="100" />
              <rect x="1279.5" y="0" width="1" height="656" />
            </g>
          </svg>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.text}>
          <h2 id="demo-title" className={`display ${styles.title}`}>
            {editable?.title ?? content.title}
          </h2>
          <p className={styles.description}>{editable?.description ?? content.description}</p>
        </div>
        <ButtonLink href={content.cta.href} size="sm" elevated>
          {editable?.['cta.label'] ?? content.cta.label}
        </ButtonLink>
      </div>

      <div className={styles.preview}>
        <Image
          src={content.image.src || demoCta.image.src}
          alt={content.image.alt}
          unoptimized
          width={1276}
          height={873}
          quality={90}
          sizes="(max-width: 1355px) 100vw, 1276px"
        />
      </div>

      <div className={styles.fades} aria-hidden="true">
        <span className={styles.fadeRight} />
        <span className={styles.fadeBottom} />
      </div>
    </section>
  );
}
