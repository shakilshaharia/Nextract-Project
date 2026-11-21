import { z } from "zod";

export const visualTypes = [
  "Heading",
  "Paragraph",
  "RichText",
  "Image",
  "Video",
  "Button",
  "Icon",
  "Divider",
  "Spacer",
  "Html",
  "Form",
  "Newsletter",
  "Container",
  "Section",
  "Columns",
  "Grid",
  "Flex",
  "Card",
  "Accordion",
  "Tabs",
  "Gallery",
  "Website",
] as const;
export const websiteKinds = [
  "Hero",
  "PageHero",
  "Stats",
  "Workflow",
  "Solutions",
  "Integrations",
  "AiAnswers",
  "Testimonials",
  "Faq",
  "DemoCta",
  "AboutStory",
  "ContactForm",
  "LegalContent",
  "PricingHero",
  "PricingPlans",
  "PlanComparison",
  "CompetitorComparison",
  "PricingWhy",
  "PricingTrial",
  "PricingFaq",
  "PartnershipHero",
  "WhyNextract",
  "PartnershipPaths",
  "EarningsCalculator",
  "PilotFaq",
  "RegisterSection",
  "ResourceLibrary",
] as const;
export const safeVisualUrl = z
  .string()
  .max(2048)
  .refine((v) => {
    if (/[\u0000-\u0020\\]/.test(v)) return false;
    if (v === "" || /^\/(?!\/)/.test(v) || /^#[\w-]*$/.test(v)) return true;
    if (/^mailto:/i.test(v))
      return /^mailto:[^@:?]+@[^@:?]+\.[^@:?]+(?:\?[^\s]*)?$/i.test(v);
    if (/^tel:/i.test(v)) return /^tel:\+?[0-9().-]{3,30}$/i.test(v);
    try {
      const url = new URL(v);
      return (
        ["http:", "https:"].includes(url.protocol) &&
        !!url.hostname &&
        !url.username &&
        !url.password
      );
    } catch {
      return false;
    }
  }, "Use a local path or a safe http(s), mailto or tel URL.");
const color = z.string().regex(/^(#[0-9a-f]{3,8}|transparent|inherit)$/i);
const number = z.number().min(0).max(2400);
export const visualStyleSchema = z
  .object({
    color: color.optional(),
    background: color.optional(),
    fontSize: number.optional(),
    fontWeight: z.enum(["300", "400", "500", "600", "700", "800"]).optional(),
    lineHeight: z.number().min(0.5).max(4).optional(),
    letterSpacing: z.number().min(-5).max(20).optional(),
    align: z.enum(["left", "center", "right"]).optional(),
    padding: number.optional(),
    margin: number.optional(),
    gap: number.optional(),
    radius: number.optional(),
    borderWidth: z.number().min(0).max(20).optional(),
    borderColor: color.optional(),
    shadow: z.enum(["none", "soft", "strong"]).optional(),
    opacity: z.number().min(0).max(1).optional(),
    width: z.number().min(1).max(100).optional(),
    height: number.optional(),
    columns: z.number().int().min(1).max(6).optional(),
    hidden: z.boolean().optional(),
  })
  .strict();
export type VisualStyle = z.infer<typeof visualStyleSchema>;
export const visualImageSchema = z
  .object({
    src: safeVisualUrl,
    alt: z.string().max(500),
    focalX: z.number().min(0).max(100),
    focalY: z.number().min(0).max(100),
    ratio: z.enum(["original", "16/9", "4/3", "1/1", "3/4"]),
  })
  .strict();
export type VisualImage = z.infer<typeof visualImageSchema>;
export type VisualBlock = {
  type: (typeof visualTypes)[number];
  props: {
    id: string;
    text?: string;
    html?: string;
    cssClass?: string;
    customCss?: string;
    formSlug?: string;
    heading?: string;
    description?: string;
    buttonLabel?: string;
    placeholder?: string;
    nameField?: boolean;
    tags?: string;
    align?: "left" | "center";
    href?: string;
    src?: string;
    alt?: string;
    image?: VisualImage;
    kind?: (typeof websiteKinds)[number];
    content?: Record<string, unknown>;
    items?: { title: string; body: string; src?: string; alt?: string }[];
    children?: VisualBlock[];
    level?: "h1" | "h2" | "h3" | "h4";
    autoplay?: boolean;
    muted?: boolean;
    loop?: boolean;
    controls?: boolean;
    style?: VisualStyle;
    tablet?: VisualStyle;
    mobile?: VisualStyle;
  };
};
export type VisualLayout = {
  zones?: Record<string,never>;
  root: { props: { title?: string } };
  content: VisualBlock[];
};
const block: z.ZodType<VisualBlock> = z.lazy(() =>
  z
    .object({
      type: z.enum(visualTypes),
      props: z
        .object({
          id: z
            .string()
            .min(1)
            .max(100)
            .regex(/^[\w-]+$/),
          text: z.string().max(100000).optional(),
          // Raw HTML for the HTML widget; sanitised on save (scripts stripped).
          // Larger cap than text fields since it holds whole blocks of markup.
          html: z.string().max(500000).optional(),
          // HTML widget: a wrapper CSS class and scoped custom CSS.
          cssClass: z.string().max(200).optional(),
          customCss: z.string().max(100000).optional(),
          // Form widget: the slug of a custom form to embed.
          formSlug: z.string().max(200).optional(),
          // Newsletter widget: inline sign-up copy and behaviour.
          heading: z.string().max(300).optional(),
          description: z.string().max(2000).optional(),
          buttonLabel: z.string().max(100).optional(),
          placeholder: z.string().max(200).optional(),
          nameField: z.boolean().optional(),
          tags: z.string().max(500).optional(),
          align: z.enum(["left", "center"]).optional(),
          href: safeVisualUrl.optional(),
          src: safeVisualUrl.optional(),
          alt: z.string().max(500).optional(),
          image: visualImageSchema.optional(),
          kind: z.enum(websiteKinds).optional(),
          content: z.record(z.string(), z.unknown()).optional(),
          items: z
            .array(
              z
                .object({
                  title: z.string().max(1000),
                  body: z.string().max(10000),
                  src: safeVisualUrl.optional(),
                  alt: z.string().max(500).optional(),
                })
                .strict(),
            )
            .max(50)
            .optional(),
          children: z.array(block).max(100).optional(),
          level: z.enum(["h1", "h2", "h3", "h4"]).optional(),
          autoplay: z.boolean().optional(),
          muted: z.boolean().optional(),
          loop: z.boolean().optional(),
          controls: z.boolean().optional(),
          style: visualStyleSchema.optional(),
          tablet: visualStyleSchema.optional(),
          mobile: visualStyleSchema.optional(),
        })
        .strict(),
    })
    .strict(),
);
export const visualLayoutSchema = z
  .object({
    root: z
      .object({
        props: z.object({ title: z.string().max(255).optional() }).strict(),
      })
      .strict(),
    content: z.array(block).max(100),
    zones: z.object({}).strict().optional(),
  })
  .strict()
  .superRefine((layout, ctx) => {
    const ids = new Set<string>();
    let count = 0;
    const walk = (blocks: VisualBlock[], depth: number) => {
      for (const b of blocks) {
        count++;
        if (count > 400 || depth > 8) {
          ctx.addIssue({
            code: "custom",
            message: "Layout exceeds 400 blocks or 8 nesting levels.",
          });
          return;
        }
        if (ids.has(b.props.id))
          ctx.addIssue({
            code: "custom",
            message: "Component IDs must be unique.",
          });
        ids.add(b.props.id);
        if (b.type === "Website" && (!b.props.kind || !b.props.content))
          ctx.addIssue({
            code: "custom",
            message: "Website components need a kind and content.",
          });
        walk(b.props.children ?? [], depth + 1);
      }
    };
    walk(layout.content, 0);
  });
