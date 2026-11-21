/* eslint-disable @next/next/no-img-element -- CMS logos may use any configured storage origin, and the CSS sizes them. */
import { brandStrip } from "@/lib/content";
import styles from "./BrandStrip.module.css";

export type BrandLogo = { name: string; src: string };

/**
 * The client trust strip. Uses the CMS "Client logos" collection when provided,
 * otherwise the bundled grayscale set so the strip is never empty. The CSS sizes
 * each logo to a fixed height with auto width, so no per-logo dimensions needed.
 */
export function BrandStrip({ items }: { items?: BrandLogo[] }) {
  const logos: BrandLogo[] =
    items && items.length > 0 ? items : brandStrip.logos.map((logo) => ({ name: logo.name, src: logo.src }));

  return (
    <div className={styles.strip}>
      <div className={styles.row}>
        <p className={styles.text}>{brandStrip.text}</p>
        <div className={styles.logosViewport}>
          <div className={styles.track}>
            {[false, true].map((duplicate) => (
              <ul
                key={duplicate ? "duplicate" : "primary"}
                className={styles.logos}
                aria-label={duplicate ? undefined : "Clients"}
                aria-hidden={duplicate || undefined}
              >
                {logos.map((logo, index) => (
                  <li key={`${logo.name}-${index}`} className={styles.logoItem}>
                    <img src={logo.src} alt={duplicate ? "" : logo.name} loading="lazy" decoding="async" />
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
