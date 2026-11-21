/* eslint-disable @next/next/no-img-element -- CMS media may use any configured storage origin. */
import type { ReactNode } from "react";
import { sectionMedia, type SectionMediaValue } from "@/lib/section-media";
import { ConsentEmbed } from "@/components/privacy/ConsentEmbed";

// Re-exported so existing imports from this module keep working.
export { sectionMedia };
export type { SectionMediaValue };

export function videoEmbed(src: string) {
  try {
    const url = new URL(src);
    if (["youtube.com", "www.youtube.com", "youtu.be", "www.youtube-nocookie.com"].includes(url.hostname)) {
      const id = url.hostname === "youtu.be" ? url.pathname.slice(1) : url.searchParams.get("v") ?? url.pathname.split("/").pop();
      if (/^[\w-]{11}$/.test(id ?? "")) return `https://www.youtube-nocookie.com/embed/${id}`;
    }
    if (["vimeo.com", "player.vimeo.com"].includes(url.hostname)) {
      const id = url.pathname.split("/").pop();
      if (/^\d+$/.test(id ?? "")) return `https://player.vimeo.com/video/${id}`;
    }
  } catch { /* Local media path. */ }
  return "";
}

export function SectionMedia({ value = sectionMedia, className, children, cover = false }: {
  value?: SectionMediaValue; className?: string; children: ReactNode; cover?: boolean;
}) {
  const style = { objectFit: cover ? "cover" as const : "contain" as const, maxWidth: "100%", ...(cover ? { position: "absolute" as const, inset: 0, width: "100%", height: "100%" } : {}) };
  if (value.mode === "image" && value.image.src)
    return <img className={className} src={value.image.src} alt={value.image.alt} style={style} />;
  if (value.mode === "video" && value.video) {
    const embed = videoEmbed(value.video);
    return embed
      ? <ConsentEmbed className={className} src={embed} title={value.description || "Section video"} style={{ ...style, pointerEvents: "auto", border: 0, width: "100%", aspectRatio: "16/9" }} />
      : <video className={className} src={value.video} aria-label={value.description || "Section video"} controls muted playsInline preload="metadata" style={{ ...style, pointerEvents: "auto" }} />;
  }
  return children;
}
