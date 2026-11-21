import {
  safeVisualUrl,
  visualLayoutSchema,
  type VisualLayout,
  type VisualBlock,
} from "@workspace/cms-content";
import { badRequest, parse } from "./http.ts";
import { sanitizeRichText, sanitizeWidgetHtml } from "./sanitize.ts";

// Bound arbitrary JSON before handing it to a recursive schema.
export function validateVisual(input: unknown): VisualLayout {
  let visited = 0;
  function clean(value: unknown, key = "", depth = 0): unknown {
    if (++visited > 30000 || depth > 30)
      throw badRequest("The layout is too large or deeply nested.");
    if (typeof value === "string") {
      // The HTML widget holds whole blocks of markup, so it gets more room than
      // a plain text/rich-text field.
      const maxLength = key === "html" ? 500000 : 100000;
      if (value.length > maxLength)
        throw badRequest("A content field is too long.");
      if (
        /^(href|src|url|image|imageUrl|video|mp4|webm|poster|icon|lottie|registrationUrl|recordingUrl|attendanceUrl)$/i.test(
          key,
        )
      ) {
        if (value && !safeVisualUrl.safeParse(value).success)
          throw badRequest(`Unsafe media or link URL in ${key}.`);
      }
      if (key === "html") return sanitizeWidgetHtml(value);
      // Custom CSS is injected into a <style> tag; strip any </style> so it
      // cannot break out into markup/script.
      if (key === "customCss") return value.replace(/<\/\s*style/gi, "");
      return value;
    }
    if (Array.isArray(value)) {
      if (value.length > 400) throw badRequest("Too many items.");
      return value.map((v) => clean(v, key, depth + 1));
    }
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => {
          if (["__proto__", "constructor", "prototype"].includes(k))
            throw badRequest("Invalid property.");
          return [k, clean(v, k, depth + 1)];
        }),
      );
    }
    return value;
  }
  const data = parse(visualLayoutSchema, clean(input));
  const walk = (blocks: VisualBlock[]) => {
    for (const b of blocks) {
      if (
        b.type === "Video" &&
        b.props.src &&
        /^(mailto|tel|#)/.test(b.props.src)
      )
        throw badRequest("Videos need a media URL.");
      if (b.type === "RichText" && b.props.text)
        b.props.text = sanitizeRichText(b.props.text);
      walk(b.props.children ?? []);
    }
  };
  walk(data.content);
  return data;
}
