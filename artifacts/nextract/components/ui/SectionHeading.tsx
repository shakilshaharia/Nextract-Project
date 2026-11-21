import type { CSSProperties, ReactNode } from "react";
import styles from "./SectionHeading.module.css";

type SectionHeadingProps = {
  id?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "center" | "left";
  /** Max widths from the Figma text boxes, so lines wrap where the design wraps. */
  titleWidth?: number;
  descriptionWidth?: number;
  gap?: number;
  descriptionSize?: "md" | "lg";
  className?: string;
};

/** Section title (Inter Display 52/60) with an optional supporting paragraph. */
export function SectionHeading({
  id,
  title,
  description,
  align = "center",
  titleWidth,
  descriptionWidth,
  gap = 24,
  descriptionSize = "lg",
  className,
}: SectionHeadingProps) {
  const style = {
    "--title-width": titleWidth ? `${titleWidth}px` : undefined,
    "--description-width": descriptionWidth ? `${descriptionWidth}px` : undefined,
    "--heading-gap": `${gap}px`,
  } as CSSProperties;

  return (
    <div className={[styles.heading, styles[align], className].filter(Boolean).join(" ")} style={style}>
      <h2 id={id} className={`display ${styles.title}`}>
        {title}
      </h2>
      {description ? (
        <p className={`${styles.description} ${styles[descriptionSize]}`}>{description}</p>
      ) : null}
    </div>
  );
}
