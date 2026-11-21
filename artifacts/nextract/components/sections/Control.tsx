import Image from "next/image";
import { control } from "@/lib/content";
import styles from "./Control.module.css";

export function Control() {
  return (
    <section className={styles.section} aria-labelledby="control-title">
      <div className={styles.inner}>
        <div className={styles.header}>
          <h2 id="control-title" className={`display ${styles.title}`}>
            {control.title}
          </h2>
          <p className={styles.description}>{control.description}</p>
        </div>

        <div className={styles.panels}>
          <ul className={styles.list}>
            {control.items.map((item) => (
              <li key={item.title} className={styles.item}>
                <h3 className={styles.itemTitle}>{item.title}</h3>
                <p className={styles.itemDescription}>{item.description}</p>
              </li>
            ))}
          </ul>
          <div className={styles.visual}>
            <Image
              src="/images/control/share-access-panel.png"
              alt="Sharing dialog with team avatars, Preview and Publish buttons, an email field, Full Access permission and a My Team entry"
              fill
              quality={90}
              sizes="(max-width: 1023px) 100vw, 731px"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
