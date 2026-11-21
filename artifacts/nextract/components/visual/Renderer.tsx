"use client";
/* eslint-disable @next/next/no-img-element -- Visual media supports arbitrary storage origins and intrinsic dimensions. */
import type { CSSProperties, ReactNode } from "react";
import type {
  VisualBlock,
  VisualLayout,
  VisualStyle,
} from "@workspace/cms-content";
import type { CmsBootstrap } from "@/lib/cms";
import { cmsFooterNav, cmsSocialLinks, managedContent } from "@/lib/cms";
import { SiteFooter } from "../layout/SiteFooter";
import { FormRenderer } from "../sections/FormRenderer";
import { NewsletterSignup } from "../sections/NewsletterSignup";
import { ConsentEmbed, ConsentHtml } from "../privacy/ConsentEmbed";
import { website } from "./website";
import styles from "./visual.module.css";

function variables(
  style: VisualStyle = {},
  prefix = "",
): Record<string, string | number> {
  const result: Record<string, string | number> = {};
  const pixels = [
    "fontSize",
    "padding",
    "margin",
    "gap",
    "radius",
    "borderWidth",
    "height",
    "letterSpacing",
  ];
  for (const [key, value] of Object.entries(style)) {
    if (key === "hidden")
      result[`--${prefix}display`] = value
        ? "none"
        : "var(--base-display, block)";
    else if (key === "shadow")
      result[`--${prefix}shadow`] =
        value === "soft"
          ? "0 8px 30px #0001"
          : value === "strong"
            ? "0 16px 50px #0003"
            : "none";
    else
      result[`--${prefix}${key}`] = pixels.includes(key)
        ? `${value}px`
        : key === "width"
          ? `${value}%`
          : String(value);
  }
  return result;
}
export function BlockFrame({
  block,
  children,
}: {
  block: VisualBlock;
  children: ReactNode;
}) {
  const p = block.props;
  const style = {
    ...variables(p.style),
    ...variables(p.tablet, "t-"),
    ...variables(p.mobile, "m-"),
  } as CSSProperties;
  return (
    <div
      data-visual-block={p.id}
      className={`${styles.block} ${["Columns", "Grid"].includes(block.type) ? styles.grid : ""} ${block.type === "Flex" ? styles.flex : ""} ${block.type === "Card" ? styles.card : ""} ${p.style?.fontSize !== undefined ? styles.customFont : ""} ${p.style?.color !== undefined ? styles.customColor : ""} ${p.tablet?.fontSize !== undefined ? styles.tabletFont : ""} ${p.mobile?.fontSize !== undefined ? styles.mobileFont : ""} ${p.tablet?.color !== undefined ? styles.tabletColor : ""} ${p.mobile?.color !== undefined ? styles.mobileColor : ""}`}
      style={style}
    >
      {children}
    </div>
  );
}
export function blockContent(
  block: VisualBlock,
  cms: CmsBootstrap | null,
  nested?: ReactNode,
  inlineText?: ReactNode,
) {
  const p = block.props;
  switch (block.type) {
    case "Website":
      return p.kind && website[p.kind]?.render(p.content ?? {}, cms);
    case "Heading": {
      const Tag = p.level ?? "h2";
      return <Tag>{inlineText ?? p.text}</Tag>;
    }
    case "Paragraph":
      return <p style={{ whiteSpace: "pre-wrap" }}>{inlineText ?? p.text}</p>;
    case "RichText":
      return (
        inlineText ?? (
          <div
            className={styles.rich}
            dangerouslySetInnerHTML={{ __html: p.text ?? "" }}
          />
        )
      );
    // Custom HTML widget. The markup is sanitised on save (scripts stripped;
    // safe tags, styling and https iframes kept). An optional CSS class is put
    // on the wrapper, and optional custom CSS is scoped to this widget: the
    // keyword `selector` is replaced with the widget's unique id so rules only
    // apply here and don't leak to the rest of the page.
    case "Html": {
      const scope = `w-${p.id}`;
      const raw = p.customCss?.trim();
      const css = raw ? raw.replace(/(^|[\s,{}>+~])selector\b/g, `$1#${scope}`) : "";
      return (
        <>
          {css ? <style dangerouslySetInnerHTML={{ __html: css }} /> : null}
          <ConsentHtml id={scope} className={p.cssClass || undefined} html={p.html ?? ""} />
        </>
      );
    }
    // Custom form widget — embeds a form built in the admin Form Builder.
    case "Form":
      return <FormRenderer slug={p.formSlug} />;
    // Newsletter sign-up widget — posts to the CMS subscribe endpoint.
    case "Newsletter":
      return (
        <NewsletterSignup
          heading={p.heading}
          description={p.description}
          buttonLabel={p.buttonLabel}
          placeholder={p.placeholder}
          nameField={p.nameField}
          tags={p.tags}
          align={p.align}
          source="builder"
        />
      );
    // Uploaded media uses the existing /uploads route; intrinsic dimensions vary.
    case "Image": {
      const image = p.image ?? {
        src: p.src,
        alt: p.alt,
        focalX: 50,
        focalY: 50,
        ratio: "original",
      };
      return image.src ? (
        <img
          src={image.src}
          alt={image.alt ?? ""}
          loading="lazy"
          className={styles.image}
          style={{
            aspectRatio: image.ratio === "original" ? undefined : image.ratio,
            objectFit: "cover",
            objectPosition: `${image.focalX}% ${image.focalY}%`,
          }}
        />
      ) : (
        <div className={styles.empty}>
          Select an image from the Media Library
        </div>
      );
    }
    case "Video": {
      if (!p.src)
        return (
          <div className={styles.empty}>
            Select a video or enter a YouTube / Vimeo URL
          </div>
        );
      let embed = "";
      try {
        const url = new URL(p.src);
        if (
          [
            "youtube.com",
            "www.youtube.com",
            "youtu.be",
            "www.youtube-nocookie.com",
          ].includes(url.hostname)
        ) {
          const id =
            url.hostname === "youtu.be"
              ? url.pathname.slice(1)
              : (url.searchParams.get("v") ?? url.pathname.split("/").pop());
          if (/^[\w-]{11}$/.test(id ?? ""))
            embed = `https://www.youtube-nocookie.com/embed/${id}`;
        }
        if (["vimeo.com", "player.vimeo.com"].includes(url.hostname)) {
          const id = url.pathname.split("/").pop();
          if (/^\d+$/.test(id ?? ""))
            embed = `https://player.vimeo.com/video/${id}`;
        }
      } catch {
        /* relative media */
      }
      return embed ? (
        <ConsentEmbed
          className={styles.video}
          src={embed}
          title={p.alt || "Video"}
        />
      ) : (
        <video
          className={styles.video}
          src={p.src}
          controls={p.controls ?? true}
          autoPlay={p.autoplay}
          muted={p.muted ?? true}
          loop={p.loop}
          preload="metadata"
        />
      );
    }
    case "Button":
      return (
        <a href={p.href || "#"} className={styles.button}>
          {p.text || "Button"}
        </a>
      );
    case "Icon":
      return (
        <span role="img" aria-label={p.alt || "Icon"}>
          {p.text || "✦"}
        </span>
      );
    case "Divider":
      return <hr />;
    case "Spacer":
      return (
        <div style={{ height: p.style?.height ?? 40 }} aria-hidden="true" />
      );
    case "Accordion":
      return (
        <>
          {p.items?.map((i, n) => (
            <details key={n} className={styles.detail}>
              <summary>{i.title}</summary>
              <p>{i.body}</p>
            </details>
          ))}
        </>
      );
    case "Tabs":
      return (
        <div className={styles.tabs}>
          {p.items?.map((i, n) => (
            <details name={p.id} key={n} open={n === 0}>
              <summary>{i.title}</summary>
              <p>{i.body}</p>
            </details>
          ))}
        </div>
      );
    case "Gallery":
      return (
        <div className={styles.gallery}>
          {p.items?.map((i, n) => (
            <figure key={n}>
              <img src={i.src} alt={i.alt || ""} loading="lazy" />
              <figcaption>{i.title}</figcaption>
            </figure>
          ))}
        </div>
      );
    default:
      return nested;
  }
}
export function VisualBlocks({
  layout,
  cms,
}: {
  layout: VisualLayout;
  cms: CmsBootstrap | null;
}) {
  const render = (blocks: VisualBlock[]): ReactNode =>
    blocks.map((b) => (
      <BlockFrame key={b.props.id} block={b}>
        {blockContent(b, cms, render(b.props.children ?? []))}
      </BlockFrame>
    ));
  return <>{render(layout.content)}</>;
}
// Whether the layout already contains a DemoCta branded section, so the
// site-wide one below is not duplicated.
function hasDemoCta(blocks: VisualBlock[]): boolean {
  return blocks.some(
    (b) =>
      (b.type === "Website" && b.props.kind === "DemoCta") ||
      hasDemoCta(b.props.children ?? []),
  );
}

export function VisualPage({
  layout,
  cms,
}: {
  layout: VisualLayout;
  cms: CmsBootstrap | null;
}) {
  // The demo call-to-action appears on every page (unless the layout already
  // has its own), just above the footer.
  const showDemoCta = !hasDemoCta(layout.content);
  return (
    <>
      <main id="main">
        <VisualBlocks layout={layout} cms={cms} />
      </main>
      {showDemoCta
        ? website.DemoCta.render(managedContent(cms, "demoCta", website.DemoCta.defaults), cms)
        : null}
      <SiteFooter items={cmsFooterNav(cms)} social={cmsSocialLinks(cms)} />
    </>
  );
}
