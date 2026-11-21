import Image from "next/image";
import { Logo } from "@/components/ui/Logo";
import { footer, type FooterLink } from "@/lib/content";
import { links } from "@/lib/site";
import styles from "./SiteFooter.module.css";

const hiddenPageLinks = new Set(["faq", "services", "features"]);

export function withoutHiddenPageLinks(items: FooterLink[]) {
  return items.filter((item) => !hiddenPageLinks.has(item.label.trim().toLowerCase()));
}

/** Footer entries without a destination in the design render as text, not dead links. */
function FooterItem({ item }: { item: FooterLink }) {
  const content = (
    <>
      {item.icon ? <Image src={item.icon} alt="" width={24} height={24} /> : null}
      <span>{item.label}</span>
    </>
  );

  const external = item.href?.startsWith("http");

  return (
    <li className={styles.item}>
      {item.href ? (
        <a
          href={item.href}
          className={styles.link}
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {content}
        </a>
      ) : (
        <span className={styles.link}>{content}</span>
      )}
      {item.badge ? <span className={styles.badge}>{item.badge}</span> : null}
    </li>
  );
}

/**
 * The footer is shared by every page. Its primary "Page links" column is driven
 * by the single CMS Footer menu when `items` are provided; otherwise it falls
 * back to the built-in links so the footer is never empty if the CMS is down.
 */
export function SiteFooter({ items, social }: { items?: { label: string; href: string | null }[]; social?: FooterLink[] }) {
  const columns = footer.columns.map((column, index) => {
    if (index === 0 && items && items.length > 0) return { ...column, links: withoutHiddenPageLinks(items as FooterLink[]) };
    if (column.title === "Social media" && social && social.length > 0) return { ...column, links: social };
    return index === 0 ? { ...column, links: withoutHiddenPageLinks(column.links) } : column;
  });

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.top}>
          <div className={styles.company}>
            <a href={links.home} className={styles.logo} aria-label="Nextract home">
              <Logo />
            </a>
            <p className={styles.description}>{footer.description}</p>
          </div>

          <div className={styles.columns}>
            {columns.map((column) => (
              <nav key={column.title} className={styles.column} aria-label={column.title}>
                <h2 className={styles.columnTitle}>{column.title}</h2>
                <ul className={styles.list}>
                  {column.links.map((item) => (
                    <FooterItem key={item.label} item={item} />
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className={styles.bottom}>
          <p>{footer.copyright}</p>
          <ul className={styles.legal}>
            {footer.legal.map((item, index) => (
              <li key={item.label}>
                {index > 0 ? <span aria-hidden="true">{"   |   "}</span> : null}
                {item.href ? <a href={item.href}>{item.label}</a> : <span>{item.label}</span>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
