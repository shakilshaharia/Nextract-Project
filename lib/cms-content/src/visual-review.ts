import { safeVisualUrl, type VisualLayout, type VisualBlock } from "./visual";

export type VisualIssue = {
  blockId: string;
  message: string;
  severity: "error" | "warning";
};
export function reviewVisual(layout: VisualLayout): VisualIssue[] {
  const issues: VisualIssue[] = [];
  const check = (blocks: VisualBlock[]) =>
    blocks.forEach((b) => {
      const p = b.props;
      const add = (
        message: string,
        severity: VisualIssue["severity"] = "warning",
      ) => issues.push({ blockId: p.id, message, severity });
      if (b.type === "Button") {
        if (!p.text?.trim()) add("A button has no label.", "error");
        if (!p.href?.trim() || p.href === "#")
          add("Choose a destination for the button.", "error");
      }
      if (["Heading", "Paragraph"].includes(b.type) && !p.text?.trim())
        add("An empty text block will appear on this page.");
      const image = p.image ?? { src: p.src, alt: p.alt };
      if (b.type === "Image") {
        if (!image.src)
          add("Choose an image or remove the empty image block.", "error");
        else if (!image.alt?.trim())
          add(
            "Add an image description, or leave it empty only if the image is decorative.",
          );
      }
      if (b.type === "Video" && !p.src)
        add("Choose a video or remove the empty video block.", "error");
      if (b.type === "Gallery")
        for (const item of p.items ?? []) {
          if (!item.src) add("A gallery item has no image.", "error");
          else if (!item.alt?.trim())
            add("A gallery image needs a description.");
        }
      const content = (value: unknown, key = "") => {
        if (
          typeof value === "string" &&
          /^(href|url|src|video|mp4|webm|poster|imageUrl|registrationUrl)$/i.test(key)
        ) {
          if (value && !safeVisualUrl.safeParse(value).success)
            add("A link or media address is invalid.", "error");
          if (key === "href" && (!value || value === "#"))
            add("A section button or link has no destination.", "error");
        } else if (value && typeof value === "object") {
          const object = value as Record<string, unknown>;
          if ("mode" in object && "image" in object && "video" in object) {
            const image = object.image as { src?: string } | undefined;
            if (object.mode === "image" && !image?.src)
              add("Choose an image for the section visual, or switch back to Original design.", "error");
            if (object.mode === "video" && !object.video)
              add("Choose a video for the section visual, or switch back to Original design.", "error");
          }
          if (
            "href" in object &&
            "label" in object &&
            !String(object.label ?? "").trim()
          )
            add("A section button has no label.", "error");
          if (
            "alt" in object &&
            ("src" in object || "url" in object) &&
            Boolean(object.src || object.url) &&
            !String(object.alt ?? "").trim()
          )
            add(
              "A section image has no description. Check whether it is decorative.",
            );
          for (const [k, v] of Object.entries(value)) content(v, k);
        }
      };
      content(p.content);
      check(p.children ?? []);
    });
  if (!layout.content.length)
    issues.push({
      blockId: "page",
      message: "This page has no sections.",
      severity: "warning",
    });
  check(layout.content);
  return issues;
}
