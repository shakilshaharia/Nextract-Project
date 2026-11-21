import type { CmsBootstrap } from '@/lib/cms';
import styles from './CmsRichText.module.css';

export function CmsRichTextBlocks({ cms }: { cms: CmsBootstrap | null }) {
  const blocks = cms?.page?.sections.filter((section) => section.type === 'richText' && section.visible && typeof section.html === 'string') ?? [];
  if (!blocks.length) return null;
  return <>{blocks.map((block) => <section key={block.id} className={styles.section}><div className={styles.content} dangerouslySetInnerHTML={{ __html: String(block.html) }} /></section>)}</>;
}
