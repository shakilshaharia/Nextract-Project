import { SectionHeading } from "@/components/ui/SectionHeading";
import { aboutPage } from "@/lib/pages";
import styles from "./AboutStory.module.css";

export function AboutStory({ content = aboutPage }: { content?: typeof aboutPage }) {
  const { story, values } = content;

  return (
    <section className={styles.section} aria-labelledby="about-story-title">
      <div className={styles.inner}>
        <div className={styles.lead}>
          <SectionHeading
            id="about-story-title"
            title={story.heading}
            align="left"
            titleWidth={760}
          />
          <div className={styles.body}>
            {story.paragraphs.map((paragraph) => (
              <p key={paragraph} className={styles.paragraph}>
                {paragraph}
              </p>
            ))}
          </div>
        </div>

        <ul className={styles.values}>
          {values.map((value) => (
            <li key={value.title} className={styles.value}>
              <h3 className={styles.valueTitle}>{value.title}</h3>
              <p className={styles.valueText}>{value.description}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
