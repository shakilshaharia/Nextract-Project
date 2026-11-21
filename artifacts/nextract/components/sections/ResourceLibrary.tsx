"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { resourcesPage } from "@/lib/pages";
import styles from "./ResourceLibrary.module.css";

type ResourceLibraryContent = {
  sectionTitle: string;
  filters: readonly string[];
  searchLabel: string;
  items: ReadonlyArray<{ category: string; meta: string; title: string; description: string; href: string; image?: string }>;
};

export function ResourceLibrary({ content = resourcesPage }: { content?: ResourceLibraryContent }) {
  const { sectionTitle, filters, searchLabel, items } = content;
  const [activeFilter, setActiveFilter] = useState<string>(filters[0]);
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesFilter = activeFilter === "All" || item.category === activeFilter;
      const matchesQuery =
        q === "" ||
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q);
      return matchesFilter && matchesQuery;
    });
  }, [activeFilter, query, items]);

  return (
    <section className={styles.section} aria-labelledby="resource-library-title">
      <div className={styles.inner}>
        <h2 id="resource-library-title" className={`display ${styles.title}`}>
          {sectionTitle}
        </h2>

        <div className={styles.controls}>
          <div className={styles.tabs} role="tablist" aria-label="Filter resources">
            {filters.map((filter) => (
              <button
                key={filter}
                type="button"
                role="tab"
                aria-selected={activeFilter === filter}
                className={styles.tab}
                data-active={activeFilter === filter}
                onClick={() => setActiveFilter(filter)}
              >
                {filter}
              </button>
            ))}
          </div>

          <label className={styles.search}>
            <span className={styles.searchLabel}>{searchLabel}</span>
            <span className={styles.searchField}>
              <svg
                className={styles.searchIcon}
                width="18"
                height="18"
                viewBox="0 0 18 18"
                fill="none"
                aria-hidden="true"
              >
                <circle cx="8" cy="8" r="5.25" stroke="currentColor" strokeWidth="1.5" />
                <path d="m12 12 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input
                type="search"
                className={styles.searchInput}
                placeholder="Search by title or topic…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label={searchLabel}
              />
            </span>
          </label>
        </div>

        {results.length > 0 ? (
          <ul className={styles.grid}>
            {results.map((item) => (
              <li key={item.title} className={styles.cardItem}>
                <a href={item.href} className={styles.card}>
                  <span className={styles.cover} data-category={item.category}>
                    {"image" in item && item.image ? (
                      <Image
                        src={item.image}
                        alt=""
                        fill
                        className={styles.coverImg}
                        sizes="(max-width: 700px) 100vw, 420px"
                      />
                    ) : (
                      <svg
                        className={styles.coverMotif}
                        viewBox="0 0 400 220"
                        preserveAspectRatio="xMidYMid slice"
                        fill="none"
                        aria-hidden="true"
                      >
                        <circle cx="332" cy="34" r="92" fill="#fff" opacity="0.12" />
                        <circle cx="56" cy="206" r="74" fill="#fff" opacity="0.1" />
                        <rect x="150" y="44" width="104" height="132" rx="12" fill="#fff" opacity="0.16" />
                        <g fill="#fff">
                          <rect x="168" y="70" width="70" height="8" rx="4" opacity="0.55" />
                          <rect x="168" y="88" width="52" height="8" rx="4" opacity="0.4" />
                          <rect x="168" y="114" width="70" height="8" rx="4" opacity="0.55" />
                          <rect x="168" y="132" width="40" height="8" rx="4" opacity="0.35" />
                        </g>
                      </svg>
                    )}
                  </span>
                  <span className={styles.cardBody}>
                    <span className={styles.meta}>{item.meta}</span>
                    <h3 className={styles.cardTitle}>{item.title}</h3>
                    <p className={styles.cardText}>{item.description}</p>
                    <span className={styles.link} aria-hidden="true">
                      Read more
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path
                          d="M3.5 8h9M9 4.5 12.5 8 9 11.5"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>No resources found</p>
            <p className={styles.emptyText}>Try a different search or filter.</p>
          </div>
        )}
      </div>
    </section>
  );
}
