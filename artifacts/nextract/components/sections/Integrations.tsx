import { SectionHeading } from "@/components/ui/SectionHeading";
import { integrations } from "@/lib/content";
import { sectionIds } from "@/lib/site";
import styles from "./Integrations.module.css";
import { SectionMedia, videoEmbed } from "@/components/ui/SectionMedia";

export function Integrations({ content = integrations }: { content?: typeof integrations }) {
  return (
    <section id={sectionIds.integrations} className={styles.section} aria-labelledby="integrations-title">
      <div className={styles.inner}>
        <SectionHeading
          id="integrations-title"
          className={styles.heading}
          title={content.title}
          description={content.description}
          titleWidth={900}
          descriptionWidth={900}
          gap={20}
        />

        <div className={styles.media}>
          <SectionMedia value={{ mode: videoEmbed(content.video) ? "video" : "original", video: content.video, image: { src: "", alt: "" }, description: "Nextract overview" }} className={styles.video}><video
            className={styles.video}
            src={content.video}
            autoPlay
            muted
            loop
            playsInline
            controls
            preload="metadata"
          /></SectionMedia>
        </div>

        <ul className={styles.list}>
          {content.items.map((item) => (
            <li key={item.title} className={styles.item}>
              <h3 className={styles.itemTitle}>{item.title}</h3>
              <p className={styles.itemDescription}>{item.description}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
