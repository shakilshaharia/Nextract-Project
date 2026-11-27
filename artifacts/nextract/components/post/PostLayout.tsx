import Image from "next/image";
import { PageHero } from "@/components/layout/PageHero";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { DemoCta } from "@/components/sections/DemoCta";
import { PostFaqs } from "@/components/post/PostFaqs";
import { ButtonLink } from "@/components/ui/Button";
import { links } from "@/lib/site";
import {
  getPostsByType,
  postHref,
  postTypeMeta,
  type BodyBlock,
  type Post,
} from "@/lib/posts";
import styles from "./PostLayout.module.css";

export function PostBody({ blocks }: { blocks: readonly BodyBlock[] }) {
  return (
    <div className={styles.body}>
      {blocks.map((block, index) => {
        switch (block.kind) {
          case "richText":
            return (
              <div
                key={index}
                className={styles.richText}
                dangerouslySetInnerHTML={{ __html: block.html }}
              />
            );
          case "heading":
            return (
              <h2 key={index} className={styles.heading}>
                {block.text}
              </h2>
            );
          case "paragraph":
            return (
              <p key={index} className={styles.paragraph}>
                {block.text}
              </p>
            );
          case "list":
            return (
              <ul key={index} className={styles.list}>
                {block.items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            );
          case "image":
            return (
              <figure key={index} className={styles.bodyFigure}>
                <Image
                  src={block.src}
                  alt={block.alt}
                  width={block.width}
                  height={block.height}
                  className={styles.bodyFigureImg}
                  sizes="(max-width: 1023px) 100vw, 880px"
                />
                {block.caption ? (
                  <figcaption className={styles.bodyFigureCaption}>{block.caption}</figcaption>
                ) : null}
              </figure>
            );
          case "quote":
            return (
              <blockquote key={index} className={styles.quote}>
                <p>{block.text}</p>
                {block.cite ? <cite className={styles.cite}>{block.cite}</cite> : null}
              </blockquote>
            );
        }
      })}
    </div>
  );
}

/** Meta row under the title — differs per post type. */
export function MetaRow({ post }: { post: Post }) {
  if (post.type === "blog") {
    return (
      <div className={styles.meta}>
        <span className={styles.metaStrong}>{post.author}</span>
        <span className={styles.metaDot} aria-hidden="true" />
        <time>{post.date}</time>
      </div>
    );
  }
  if (post.type === "success-story") {
    return (
      <div className={styles.meta}>
        <span className={styles.metaStrong}>{post.industry}</span>
        <span className={styles.metaDot} aria-hidden="true" />
        <span>{post.timeline}</span>
      </div>
    );
  }
  return (
    <div className={styles.meta}>
      <span className={styles.metaStrong}>{post.date}</span>
      <span className={styles.metaDot} aria-hidden="true" />
      <span>{post.time}</span>
      <span className={styles.metaDot} aria-hidden="true" />
      <span>{post.format}</span>
    </div>
  );
}

/** Short meta line for a related-post link. */
function relatedMeta(post: Post): string {
  if (post.type === "blog") return `Blog · ${post.kicker}`;
  if (post.type === "success-story") return `Success story · ${post.industry}`;
  return `Event · ${post.date}`;
}

/** Key facts card in the sidebar — differs per post type. */
export function DetailsCard({ post }: { post: Post }) {
  if (post.type === "event") {
    return (
      <div className={styles.sideCard}>
        <p className={styles.sideTitle}>Event details</p>
        <dl className={styles.sideDl}>
          <div>
            <dt>Date</dt>
            <dd>{post.date}</dd>
          </div>
          <div>
            <dt>Time</dt>
            <dd>{post.time}</dd>
          </div>
          <div>
            <dt>Duration</dt>
            <dd>{post.duration}</dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>{post.location}</dd>
          </div>
        </dl>
        <ButtonLink href={links.contact} elevated className={styles.sideBtn}>
          Register your interest
        </ButtonLink>
      </div>
    );
  }

  if (post.type === "success-story") {
    return (
      <div className={styles.sideCard}>
        <p className={styles.sideTitle}>At a glance</p>
        <dl className={styles.sideDl}>
          <div>
            <dt>Industry</dt>
            <dd>{post.industry}</dd>
          </div>
          <div>
            <dt>Timeline</dt>
            <dd>{post.timeline}</dd>
          </div>
        </dl>
        <dl className={styles.sideStats} aria-label="Results">
          {post.results.map((r) => (
            <div key={r.label} className={styles.sideStat}>
              <dt className={styles.sideStatValue}>{r.value}</dt>
              <dd className={styles.sideStatLabel}>{r.label}</dd>
            </div>
          ))}
        </dl>
      </div>
    );
  }

  return (
    <div className={styles.sideCard}>
      <p className={styles.sideTitle}>About this article</p>
      <dl className={styles.sideDl}>
        <div>
          <dt>Written by</dt>
          <dd>{post.author}</dd>
        </div>
        <div>
          <dt>Published</dt>
          <dd>{post.date}</dd>
        </div>
        <div>
          <dt>Read time</dt>
          <dd>{post.kicker}</dd>
        </div>
      </dl>
    </div>
  );
}

function Sidebar({ post, related }: { post: Post; related: NonNullable<Post["related"]> }) {
  return (
    <aside className={styles.sidebar} aria-label="More information">
      <DetailsCard post={post} />

      {related.length ? (
        <div className={styles.sideCard}>
          <p className={styles.sideTitle}>Related resources</p>
          <ul className={styles.related}>
            {related.map((r) => (
              <li key={r.href} className={styles.relatedItem}>
                <a href={r.href} className={styles.relatedLink}>
                  {r.title}
                </a>
                <span className={styles.relatedMeta}>{r.meta}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className={styles.ctaCard}>
        <p className={styles.ctaHeading}>See Nextract in action</p>
        <p className={styles.ctaText}>
          Turn your documents into structured, validated data — with people in control.
        </p>
        <ButtonLink href={links.bookDemo} elevated className={styles.sideBtn}>
          Book a demo
        </ButtonLink>
      </div>
    </aside>
  );
}

export function PostFaqJsonLd({ faqs }: { faqs: NonNullable<Post["faqs"]> }) {
  // Structured data so the FAQs can appear as rich results in search.
  if (faqs.length === 0) return null;
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c") }}
    />
  );
}

export function PostLayout({ post }: { post: Post }) {
  const type = postTypeMeta[post.type];
  const related = post.related ?? getPostsByType(post.type)
    .filter((p) => p.slug !== post.slug)
    .slice(0, 3)
    .map((p) => ({ href: postHref(p), title: p.title, meta: relatedMeta(p) }));
  const faqs = (post.faqs ?? []).filter((f) => f.question.trim() && f.answer.trim());

  return (
    <>
      <PostFaqJsonLd faqs={faqs} />
      <main>
        <PageHero>
          <header className={styles.header}>
            <nav className={styles.breadcrumb} aria-label="Breadcrumb">
              <a href={links.resources}>Resources</a>
              <span aria-hidden="true">/</span>
              <span>{type.label}</span>
            </nav>
            <p className={styles.eyebrow}>
              {type.eyebrow}
              {post.kicker.toLowerCase() !== type.eyebrow.toLowerCase() ? (
                <>
                  <span className={styles.eyebrowDot} aria-hidden="true" />
                  {post.kicker}
                </>
              ) : null}
            </p>
            <h1 className={`display ${styles.title}`}>{post.title}</h1>
            <p className={styles.excerpt}>{post.excerpt}</p>
            <MetaRow post={post} />
          </header>
        </PageHero>

        <section className={styles.article} aria-label="Article">
          <div className={styles.layout}>
            <div className={styles.main}>
              {post.image ? (
                <figure className={styles.banner}>
                  <Image
                    src={post.image.src}
                    unoptimized={/^https?:\/\//i.test(post.image.src)}
                    alt={post.image.alt}
                    width={post.image.width}
                    height={post.image.height}
                    className={styles.bannerImg}
                    sizes="(max-width: 1023px) 100vw, 880px"
                    priority
                  />
                </figure>
              ) : null}

              <PostBody blocks={post.body} />

              {post.type === "event" && post.speakers.length ? (
                <div className={styles.speakers}>
                  <h2 className={styles.heading}>Hosted by</h2>
                  <ul>
                    {post.speakers.map((s) => (
                      <li key={s.name}>
                        <span className={styles.metaStrong}>{s.name}</span> — {s.role}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {faqs.length ? <PostFaqs items={faqs} /> : null}

              <a className={styles.back} href={type.base}>
                ← Back to {type.labelPlural.toLowerCase()}
              </a>
            </div>

            <Sidebar post={post} related={related} />
          </div>
        </section>

        <DemoCta />
      </main>
      <SiteFooter />
    </>
  );
}
