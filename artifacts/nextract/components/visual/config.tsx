"use client";
import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import {
  AutoField,
  InlineTextField,
  type Config,
  type ComponentConfig,
  type Field,
  type Fields,
  type SlotComponent,
} from "@puckeditor/core";
import {
  visualTypes,
  type VisualBlock,
  type VisualStyle,
} from "@workspace/cms-content";
import type { CmsBootstrap } from "@/lib/cms";
import { BlockFrame, blockContent } from "./Renderer";
import { ImageProperties, ImageReference, MediaField } from "./MediaField";
import { ColorControl, LinkField, StylePresets, TextList } from "./Controls";
import { website } from "./website";
import styles from "./visual.module.css";
import { SectionMediaField } from "./SectionMediaField";
import { disabledFeatures } from "@/config/disabled-features";
import { FormPicker } from "./FormPicker";

// Syntax-highlighting code editor for the HTML widget, loaded client-only so
// CodeMirror never runs during SSR.
const CodeField = dynamic(() => import("./CodeField").then((m) => m.CodeField), {
  ssr: false,
  loading: () => <div style={{ height: 260, borderRadius: 10, background: "#f4f4f5" }} />,
});

export type EditorMode = "content" | "design";
const names: Record<string, string> = {
  // Headings & text
  title: "Main heading",
  titleLead: "Main heading",
  titleTrail: "Highlighted heading",
  heading: "Heading",
  subheading: "Subheading",
  subtitle: "Subheading",
  eyebrow: "Small heading above title",
  kicker: "Small heading above title",
  description: "Description",
  body: "Body text",
  lede: "Introduction",
  lead: "Introduction",
  intro: "Introduction",
  text: "Text",
  note: "Note",
  disclaimer: "Small print",
  footnote: "Small print",
  // Buttons / links
  cta: "Button",
  ctaLabel: "Button text",
  ctaHref: "Button destination",
  button: "Button",
  buttonLabel: "Button text",
  buttonHref: "Button destination",
  label: "Button text",
  href: "Button destination",
  url: "Link",
  link: "Link",
  secondaryCta: "Secondary button",
  submit: "Submit button text",
  submitLabel: "Submit button text",
  // Media
  src: "Image",
  image: "Image",
  images: "Images",
  alt: "Image description",
  media: "Image or video",
  video: "Video",
  poster: "Video cover image",
  mp4: "MP4 video",
  webm: "WebM video",
  illustration: "Illustration image",
  illustrationAlt: "Illustration description",
  icon: "Icon",
  logo: "Logo",
  // Lists / items
  items: "Items",
  list: "List",
  cards: "Cards",
  features: "Features",
  benefits: "Benefits",
  steps: "Steps",
  plans: "Plans",
  tabs: "Tabs",
  points: "Points",
  // Item fields
  q: "Question",
  a: "Answer",
  question: "Question",
  answer: "Answer",
  quote: "Quote",
  author: "Name",
  name: "Name",
  role: "Role / title",
  segment: "Segment",
  outcome: "Outcome",
  explanation: "Details",
  value: "Value",
  unit: "Unit",
  prefix: "Prefix",
  suffix: "Suffix",
  badge: "Badge",
  caption: "Caption",
  // Section container
  content: "Section content",
};
const label = (key: string) =>
  names[key] ??
  key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());

// Friendly name, one-line description, and (for sections that read shared data)
// the collection they come from — shown at the top of the settings panel so
// editors know what they are editing.
const sectionMeta: Partial<
  Record<string, { name: string; description: string; collection?: { label: string; href: string } }>
> = {
  Hero: { name: "Hero banner", description: "The main heading, introduction and button at the top of the homepage." },
  PageHero: { name: "Page header", description: "The heading band at the top of an inner page." },
  Stats: { name: "Statistics", description: "Key numbers shown in a row.", collection: { label: "Metrics", href: "/admin/collections/metrics" } },
  Workflow: { name: "Workflow", description: "The step-by-step “how it works” section." },
  Solutions: { name: "Solutions", description: "The grid of solutions and use cases." },
  Integrations: { name: "Platform & integrations", description: "The platform overview and integration logos." },
  AiAnswers: { name: "AI answers", description: "The questions-and-answers highlight." },
  Testimonials: { name: "Customer testimonials", description: "Customer quotes.", collection: { label: "Testimonials", href: "/admin/collections/testimonials" } },
  Faq: { name: "Frequently asked questions", description: "The Q&A list.", collection: { label: "FAQs", href: "/admin/collections/faqs" } },
  DemoCta: { name: "Call to action", description: "The highlighted call-to-action with a button and app preview." },
  AboutStory: { name: "About story", description: "The narrative “our story” section." },
  ContactForm: { name: "Contact section", description: "The contact form and its supporting copy." },
  LegalContent: { name: "Legal content", description: "The long-form legal text." },
  PricingHero: { name: "Pricing header", description: "The heading for the pricing page." },
  PricingPlans: { name: "Pricing plans", description: "The pricing cards." },
  PlanComparison: { name: "Plan comparison", description: "The feature comparison table." },
  CompetitorComparison: { name: "Competitor comparison", description: "The comparison against alternatives." },
  PricingWhy: { name: "Why Nextract", description: "Reasons to choose Nextract." },
  PricingTrial: { name: "Pricing trial", description: "The trial / get-started band." },
  PricingFaq: { name: "Pricing FAQ", description: "Pricing questions and answers." },
  PartnershipHero: { name: "Partnership header", description: "The heading for the partnership page." },
  WhyNextract: { name: "Why partner", description: "Reasons to partner with Nextract." },
  PartnershipPaths: { name: "Partnership paths", description: "The partner program tiers." },
  EarningsCalculator: { name: "Earnings calculator", description: "The interactive earnings estimate." },
  PilotFaq: { name: "Pilot & FAQ", description: "Pilot program details and questions." },
  RegisterSection: { name: "Register", description: "The sign-up / register band." },
  ResourceLibrary: { name: "Resource library", description: "The list of published resources.", collection: { label: "Resources", href: "/admin/posts" } },
};

function SectionInfo({ kind }: { kind: string }) {
  const meta = sectionMeta[kind];
  const name = meta?.name ?? kind.replace(/([A-Z])/g, " $1").trim();
  return (
    <div style={{ marginBottom: 10, padding: "10px 12px", borderRadius: 10, background: "#f4f5f7", border: "1px solid #ececf0" }}>
      <div style={{ fontWeight: 600, fontSize: 13, color: "#1f2937" }}>{name}</div>
      {meta?.description ? (
        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2, lineHeight: 1.5 }}>{meta.description}</div>
      ) : null}
      {meta?.collection ? (
        <div style={{ fontSize: 12, color: "#92400e", marginTop: 8, padding: "6px 8px", borderRadius: 8, background: "#fffbeb", border: "1px solid #fde68a", lineHeight: 1.5 }}>
          This content is managed in{" "}
          <a href={meta.collection.href} target="_blank" rel="noopener noreferrer" style={{ color: "#92400e", fontWeight: 600 }}>
            Collections → {meta.collection.label}
          </a>
          . Changes there apply everywhere this section appears.
        </div>
      ) : null}
    </div>
  );
}
const media = (kind: "image" | "video"): Field => ({
  type: "custom",
  render: ({ value, onChange }) => (
    <MediaField kind={kind} value={value} onChange={onChange} />
  ),
});
const link: Field = {
  type: "custom",
  render: ({ value, onChange }) => (
    <LinkField value={value} onChange={onChange} />
  ),
};
function fixedItemsField(template: unknown, mode: EditorMode): Field {
  return {
    type: "custom",
    render: ({ value = [], onChange }) => (
      <div className="visual-field">
        {value.length === 0 && <small>No items in this section.</small>}
        {value.map((item: Record<string, unknown>, index: number) => (
          <fieldset key={index}>
            <legend>
              {String(
                item.title ?? item.label ?? item.name ?? `Item ${index + 1}`,
              )}
            </legend>
            <AutoField
              field={{
                type: "object",
                objectFields: objectFields(template, mode),
              }}
              value={item}
              onChange={(next) =>
                onChange(
                  value.map((current: unknown, at: number) =>
                    at === index ? next : current,
                  ),
                )
              }
            />
          </fieldset>
        ))}
      </div>
    ),
  };
}
function fieldsFrom(value: unknown, key: string, mode: EditorMode): Field {
  if (
    value &&
    typeof value === "object" &&
    "mode" in value &&
    "image" in value &&
    "video" in value
  )
    return {
      type: "custom",
      render: ({ value, onChange }) => (
        <SectionMediaField value={value} onChange={onChange} />
      ),
    };
  if (Array.isArray(value))
    return typeof value[0] === "object"
      ? mode === "content"
        ? fixedItemsField(value[0], mode)
        : {
            type: "array",
            arrayFields: objectFields(value[0], mode),
            defaultItemProps: value[0] ?? {},
            getItemSummary: (i) =>
              String(i.title ?? i.label ?? i.name ?? i.q ?? "Item"),
          }
      : {
          type: "custom",
          render: ({ value, onChange }) => (
            <TextList
              value={value}
              onChange={onChange}
              allowStructure={mode === "design"}
            />
          ),
        };
  if (
    value &&
    typeof value === "object" &&
    "alt" in value &&
    ("src" in value || "url" in value)
  )
    return {
      type: "custom",
      render: ({ value, onChange }) => (
        <ImageReference value={value} onChange={onChange} />
      ),
    };
  if (value && typeof value === "object")
    return { type: "object", objectFields: objectFields(value, mode) };
  if (typeof value === "boolean")
    return {
      type: "radio",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    };
  if (typeof value === "number") return { type: "number" };
  if (/^(href|url|registrationUrl|attendanceUrl)$/i.test(key)) return link;
  if (
    /^(image|imageUrl|src|poster|fallbackImage|icon|illustration)$/i.test(key)
  )
    return media("image");
  if (/^(mp4|webm|video|recordingUrl)$/i.test(key)) return media("video");
  return /^(description|body|text|subtitle|lead|lede|answer|quote|a)$/i.test(
    key,
  )
    ? { type: "textarea" }
    : { type: "text" };
}
function objectFields(value: unknown, mode: EditorMode): Fields {
  return Object.fromEntries(
    Object.entries((value ?? {}) as Record<string, unknown>)
      .filter(
        ([k, v]) =>
          (mode === "design" ||
            (typeof v !== "number" &&
              typeof v !== "boolean" &&
              !["tone", "variant", "size", "color", "background"].includes(
                k,
              ))) &&
          ![
            "id",
            "anchorId",
            "lottie",
            "animation",
            "illustration",
            "align",
          ].includes(k),
      )
      .map(([k, v]) => [k, { ...fieldsFrom(v, k, mode), label: label(k) }]),
  );
}
const num = (max = 2400, min = 0): Field => ({ type: "number", min, max });
const color: Field = {
  type: "custom",
  render: ({ value, onChange }) => (
    <ColorControl value={value} onChange={onChange} />
  ),
};
const styleFields: Fields = {
  color,
  background: color,
  fontSize: num(240),
  fontWeight: {
    type: "select",
    options: ["300", "400", "500", "600", "700", "800"].map((v) => ({
      label: v,
      value: v,
    })),
  },
  lineHeight: num(4, 0.5),
  letterSpacing: num(20, -5),
  align: {
    type: "radio",
    options: ["left", "center", "right"].map((v) => ({ label: v, value: v })),
  },
  padding: num(240),
  margin: num(240),
  gap: num(240),
  radius: num(240),
  borderWidth: num(20),
  borderColor: color,
  shadow: {
    type: "select",
    options: ["none", "soft", "strong"].map((v) => ({ label: v, value: v })),
  },
  opacity: num(1),
  width: num(100, 1),
  height: num(),
  columns: num(6, 1),
  hidden: {
    type: "radio",
    options: [
      { label: "Visible", value: false },
      { label: "Hidden", value: true },
    ],
  },
};
function StyleEditor({
  value = {},
  onChange,
  layout,
}: {
  value: VisualStyle;
  onChange: (v: VisualStyle) => void;
  layout: boolean;
}) {
  return (
    <>
      <StylePresets value={value} onChange={onChange} layout={layout} />
      <details className="visual-advanced">
        <summary>Advanced styling</summary>
        <AutoField
          field={{ type: "object", objectFields: styleFields }}
          value={value}
          onChange={onChange}
        />
      </details>
    </>
  );
}
const appearance = (layout = false): Fields => ({
  style: {
    type: "custom",
    label: "Appearance",
    render: ({ value, onChange }) => (
      <StyleEditor value={value} onChange={onChange} layout={layout} />
    ),
  },
  tablet: {
    type: "object",
    label: "Advanced: tablet overrides",
    objectFields: Object.fromEntries(
      [
        "fontSize",
        "padding",
        "margin",
        "gap",
        "align",
        "columns",
        "width",
        "height",
        "hidden",
        "color",
        "background",
      ].map((k) => [k, styleFields[k]]),
    ),
  },
  mobile: {
    type: "object",
    label: "Advanced: mobile overrides",
    objectFields: Object.fromEntries(
      [
        "fontSize",
        "padding",
        "margin",
        "gap",
        "align",
        "columns",
        "width",
        "height",
        "hidden",
        "color",
        "background",
      ].map((k) => [k, styleFields[k]]),
    ),
  },
});
const inlinePaths: Record<string, string[]> = {
  Hero: ["titleLead", "titleTrail", "description", "cta.label"],
  PageHero: ["title", "subtitle", "eyebrow"],
  DemoCta: ["title", "description", "cta.label"],
};
const getPath = (value: Record<string, unknown>, path: string): string => {
  let next: unknown = value;
  for (const key of path.split("."))
    next =
      next && typeof next === "object"
        ? (next as Record<string, unknown>)[key]
        : undefined;
  return typeof next === "string" ? next : "";
};

export function makeConfig(
  cms: CmsBootstrap | null,
  mode: EditorMode = "content",
  allowDesign = !disabledFeatures.visualBuilderDesign,
): Config {
  if (!allowDesign) mode = "content";
  const components: Record<string, ComponentConfig> = {};
  const layouts = ["Container", "Section", "Columns", "Grid", "Flex", "Card"];
  for (const type of visualTypes.filter((t) => t !== "Website")) {
    const fields: Fields = {},
      defaults: Record<string, unknown> = { style: {}, tablet: {}, mobile: {} };
    if (["Heading", "Paragraph", "RichText", "Button", "Icon"].includes(type)) {
      fields.text =
        type === "RichText"
          ? { type: "richtext", contentEditable: true }
          : {
              type: "text",
              label: type === "Button" ? "Button text" : "Text",
              contentEditable: ["Heading", "Paragraph"].includes(type),
            };
      defaults.text =
        type === "RichText"
          ? "<p>Write your content.</p>"
          : type === "Heading"
            ? "Your heading"
            : type === "Button"
              ? "Learn more"
              : type === "Icon"
                ? "✦"
                : "Write your paragraph.";
    }
    if (type === "Heading") {
      if (mode === "design")
        fields.level = {
          type: "select",
          label: "Heading level",
          options: ["h1", "h2", "h3", "h4"].map((v) => ({
            label: v,
            value: v,
          })),
        };
      defaults.level = "h2";
    }
    if (type === "Button") {
      fields.href = { ...link, label: "Button destination" };
      defaults.href = "/contact";
    }
    if (type === "Image") {
      fields.image = {
        type: "custom",
        label: "Image",
        render: ({ value, onChange }) => (
          <ImageProperties
            value={value}
            onChange={onChange}
            allowCrop={mode === "design"}
          />
        ),
      };
      defaults.image = {
        src: "",
        alt: "",
        focalX: 50,
        focalY: 50,
        ratio: "original",
      };
    }
    if (type === "Video") {
      fields.src = media("video");
      fields.alt = { type: "text", label: "Video title" };
      defaults.src = "";
      defaults.alt = "";
      for (const k of ["controls", "autoplay", "muted", "loop"]) {
        if (mode === "design")
          fields[k] = {
            type: "radio",
            label: label(k),
            options: [
              { label: "Yes", value: true },
              { label: "No", value: false },
            ],
          };
        defaults[k] = k === "controls" || k === "muted";
      }
    }
    if (["Accordion", "Tabs", "Gallery"].includes(type)) {
      fields.items = {
        type: "array",
        arrayFields: {
          title: { type: "text" },
          body: { type: "textarea" },
          ...(type === "Gallery"
            ? {
                src: media("image"),
                alt: { type: "text" as const, label: "Image description" },
              }
            : {}),
        },
        defaultItemProps: {
          title: "Item",
          body: "Description",
          ...(type === "Gallery" ? { src: "", alt: "" } : {}),
        },
        getItemSummary: (i) => i.title,
      };
      defaults.items = [];
      if (mode === "content")
        fields.items = fixedItemsField(
          {
            title: "",
            body: "",
            ...(type === "Gallery" ? { src: "", alt: "" } : {}),
          },
          mode,
        );
    }
    if (type === "Html") {
      fields.html = {
        type: "custom",
        label: "HTML code",
        render: ({ value, onChange }) => (
          <CodeField value={value as string} onChange={onChange} language="html" placeholder="<div>…</div>" />
        ),
      };
      fields.cssClass = { type: "text", label: "CSS class" };
      fields.customCss = {
        type: "custom",
        label: "Custom CSS",
        render: ({ value, onChange }) => (
          <CodeField value={value as string} onChange={onChange} language="css" placeholder="selector h2 { color: #fff }" />
        ),
      };
      defaults.html = "<div>\n  <!-- Paste your HTML here -->\n</div>";
      defaults.cssClass = "";
      defaults.customCss = "";
    }
    if (type === "Form") {
      fields.formSlug = {
        type: "custom",
        label: "Form",
        render: ({ value, onChange }) => <FormPicker value={value as string} onChange={onChange} />,
      };
      defaults.formSlug = "";
    }
    if (type === "Newsletter") {
      fields.heading = { type: "text", label: "Heading" };
      fields.description = { type: "textarea", label: "Description" };
      fields.buttonLabel = { type: "text", label: "Button text" };
      fields.placeholder = { type: "text", label: "Email placeholder" };
      fields.nameField = {
        type: "radio",
        label: "Ask for name",
        options: [
          { label: "No", value: false },
          { label: "Yes", value: true },
        ],
      };
      fields.tags = { type: "text", label: "Tag subscribers (comma-separated)" };
      fields.align = {
        type: "radio",
        label: "Alignment",
        options: [
          { label: "Left", value: "left" },
          { label: "Center", value: "center" },
        ],
      };
      defaults.heading = "Subscribe to our newsletter";
      defaults.description = "Get product updates and insights in your inbox.";
      defaults.buttonLabel = "Subscribe";
      defaults.placeholder = "you@company.com";
      defaults.nameField = false;
      defaults.tags = "";
      defaults.align = "left";
    }
    if (layouts.includes(type)) {
      fields.children = { type: "slot" };
      defaults.children = [];
      defaults.style = { padding: 32, gap: 20 };
    }
    // The HTML widget has its own CSS class + custom CSS fields instead of the
    // generic spacing/colour/responsive styling controls.
    if (mode === "design" && type !== "Html" && type !== "Form" && type !== "Newsletter")
      Object.assign(fields, appearance(["Columns", "Grid"].includes(type)));
    components[type] = {
      label: type === "Html" ? "HTML" : label(type),
      fields,
      defaultProps: defaults,
      render: (props) => {
        const Children = props.children as SlotComponent | undefined;
        return (
          <BlockFrame block={{ type, props } as VisualBlock}>
            {blockContent(
              { type, props } as VisualBlock,
              cms,
              Children ? <Children className={styles.slot} /> : null,
              ["Heading", "Paragraph", "RichText"].includes(type) &&
                props.puck?.isEditing
                ? props.text
                : undefined,
            )}
          </BlockFrame>
        );
      },
    };
  }
  components.Website = {
    label: "Website section",
    fields: {},
    // No component-level permission override: Website sections use the editor's
    // global permissions, so both delete and duplicate are available (duplicates
    // get a new unique id from Puck).
    defaultProps: { kind: "DemoCta", content: website.DemoCta.defaults },
    // Only the section's own content is editable — no generic spacing/colour/
    // responsive styling controls; branded sections keep their original design.
    // A read-only info header at the top orients the editor and flags sections
    // whose data lives in a shared Collection.
    resolveFields: (data) => {
      const kind = data.props.kind as keyof typeof website;
      return {
        content: {
          type: "object",
          label: "Section content",
          objectFields: {
            __info: { type: "custom", label: "", render: () => <SectionInfo kind={kind} /> },
            ...objectFields(website[kind]?.defaults ?? {}, mode),
          },
        },
      };
    },
    render: (props) => {
      const kind = props.kind as keyof typeof website;
      const editable = props.puck?.isEditing
        ? Object.fromEntries(
            (inlinePaths[kind] ?? []).map((path) => [
              path,
              <InlineTextField
                key={path}
                componentId={props.id}
                propPath={`content.${path}`}
                value={getPath(props.content ?? {}, path)}
                isReadOnly={false}
                opts={{ disableLineBreaks: true }}
              />,
            ]),
          )
        : undefined;
      return (
        <BlockFrame block={{ type: "Website", props } as VisualBlock}>
          {website[kind]?.render(props.content ?? {}, cms, editable)}
        </BlockFrame>
      );
    },
  };
  return {
    root: {
      fields: {},
      render: ({ children }: { children: ReactNode }) => (
        <main id="main">{children}</main>
      ),
    },
    categories: {
      // Only the HTML widget is offered in the palette. The other components
      // stay registered (so existing layouts still render) but are hidden.
      // Form and Newsletter are hidden because their admin modules (Forms,
      // Subscribers) were removed from the backend menu.
      html: {
        title: "Widgets",
        components: ["Html"],
      },
      leadWidgets: {
        title: "Lead widgets",
        visible: false,
        components: ["Form", "Newsletter"],
      },
      basic: {
        title: "Basic elements",
        visible: false,
        components: [
          "Heading",
          "Paragraph",
          "RichText",
          "Image",
          "Video",
          "Button",
          "Icon",
          "Divider",
          "Spacer",
        ],
      },
      layout: {
        title: "Layout",
        visible: false,
        components: [...layouts, "Tabs", "Accordion", "Gallery"],
      },
      website: {
        title: "Branded sections: use Add section above",
        components: ["Website"],
        visible: false,
      },
      other: { visible: false },
    },
    components,
  };
}
