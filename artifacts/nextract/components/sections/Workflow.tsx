import { SectionHeading } from "@/components/ui/SectionHeading";
import { workflow } from "@/lib/content";
import { sectionIds } from "@/lib/site";
import { WorkflowTabs } from "./WorkflowTabs";
import styles from "./Workflow.module.css";

export function Workflow({ content = workflow }: { content?: typeof workflow }) {
  return (
    <section id={sectionIds.features} className={styles.section} aria-labelledby="workflow-title">
      <div className={styles.inner}>
        <SectionHeading
          id="workflow-title"
          title={content.title}
          description={content.description}
          titleWidth={658}
          descriptionWidth={658}
        />
        <WorkflowTabs content={content} />
      </div>
    </section>
  );
}
