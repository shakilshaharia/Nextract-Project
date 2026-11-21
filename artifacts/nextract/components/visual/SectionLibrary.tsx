"use client";
import { useState } from "react";
import { visualTypes, type VisualBlock } from "@workspace/cms-content";
import { website } from "./website";
import { makeConfig } from "./config";

const basicConfig = makeConfig(null, "design");
// Offer the same blocks as the editor palette: types in visible categories only
// (hidden categories stay registered so existing pages still render).
const offeredTypes = new Set(
  Object.values(basicConfig.categories ?? {})
    .filter((category) => category.visible !== false)
    .flatMap((category) => category.components ?? []),
);

type Preset = {
  name: string;
  description: string;
  thumbnail: "hero" | "split" | "cards" | "list" | "form";
  kind?: keyof typeof website;
  create?: () => VisualBlock;
};
const block = (
  type: VisualBlock["type"],
  props: Omit<VisualBlock["props"], "id">,
): VisualBlock => ({
  type,
  props: { id: `${type}-${crypto.randomUUID()}`, ...props },
});
export const sectionPresets: Preset[] = [
  {
    name: "Hero banner",
    description: "A branded heading, introduction and button.",
    thumbnail: "hero",
    create: () =>
      block("Section", {
        style: { padding: 64, background: "#f4f5f6" },
        children: [
          block("Heading", {
            text: "Your next chapter starts here",
            level: "h1",
            style: { fontSize: 48, color: "#1f3f5c" },
          }),
          block("Paragraph", {
            text: "Introduce your business and explain how you help your customers.",
            style: { fontSize: 18, margin: 16 },
          }),
          block("Button", { text: "Get in touch", href: "/contact" }),
        ],
      }),
  },
  {
    name: "Text beside image",
    description: "Tell your story with an image and a clear message.",
    thumbnail: "split",
    create: () =>
      block("Columns", {
        style: { padding: 32, gap: 32, columns: 2 },
        mobile: { columns: 1, padding: 20 },
        children: [
          block("Container", {
            children: [
              block("Heading", {
                text: "Built around your business",
                level: "h2",
                style: { fontSize: 32 },
              }),
              block("Paragraph", {
                text: "Explain what makes your service different and why it matters.",
                style: { margin: 16 },
              }),
              block("Button", { text: "Learn more", href: "/about" }),
            ],
          }),
          block("Image", {
            image: {
              src: "/images/solutions/workspace-photo.jpg",
              alt: "A collaborative workspace",
              focalX: 50,
              focalY: 50,
              ratio: "4/3",
            },
          }),
        ],
      }),
  },
  {
    name: "Customer testimonials",
    description: "Uses the testimonials managed in your shared collection.",
    thumbnail: "cards",
    kind: "Testimonials",
  },
  {
    name: "Pricing plans",
    description: "The existing Nextract pricing design, ready to edit.",
    thumbnail: "cards",
    kind: "PricingPlans",
  },
  {
    name: "Frequently asked questions",
    description: "Uses questions from your shared FAQ collection.",
    thumbnail: "list",
    kind: "Faq",
  },
  {
    name: "Contact section",
    description: "The existing contact form and its supporting copy.",
    thumbnail: "form",
    kind: "ContactForm",
  },
  {
    name: "Call to action",
    description: "The existing branded call to action with button.",
    thumbnail: "hero",
    kind: "DemoCta",
  },
  {
    name: "Statistics",
    description: "Uses metrics managed in your shared collection.",
    thumbnail: "cards",
    kind: "Stats",
  },
];
export function createSection(preset: Preset): VisualBlock {
  return preset.create
    ? preset.create()
    : block("Website", {
        kind: preset.kind!,
        content: structuredClone(website[preset.kind!].defaults),
      });
}
export function SectionThumbnail({ type }: { type: Preset["thumbnail"] }) {
  return (
    <svg
      viewBox="0 0 240 120"
      role="img"
      aria-label={`${type} section preview`}
      className="visual-section-thumbnail"
    >
      <rect x="0" y="0" width="240" height="120" rx="8" fill="#f4f5f6" />
      {type === "hero" ? (
        <>
          <rect x="24" y="25" width="150" height="12" rx="3" fill="#1f3f5c" />
          <rect x="24" y="48" width="188" height="5" rx="2" fill="#cbd5e1" />
          <rect x="24" y="60" width="150" height="5" rx="2" fill="#cbd5e1" />
          <rect x="24" y="80" width="65" height="18" rx="9" fill="#0082fb" />
        </>
      ) : type === "split" ? (
        <>
          <rect x="130" y="18" width="94" height="84" rx="6" fill="#dbeafe" />
          <circle cx="177" cy="51" r="15" fill="#93c5fd" />
          <path d="M140 92l25-24 15 12 15-18 20 30" fill="#0082fb" />
          <rect x="18" y="30" width="90" height="10" rx="3" fill="#1f3f5c" />
          <rect x="18" y="52" width="90" height="5" fill="#cbd5e1" />
          <rect x="18" y="64" width="75" height="5" fill="#cbd5e1" />
          <rect x="18" y="82" width="50" height="14" rx="7" fill="#0082fb" />
        </>
      ) : type === "cards" ? (
        <>
          {[18, 90, 162].map((x) => (
            <g key={x}>
              <rect x={x} y="22" width="60" height="78" rx="6" fill="white" />
              <rect
                x={x + 9}
                y="34"
                width="40"
                height="9"
                rx="2"
                fill="#0082fb"
              />
              <rect x={x + 9} y="55" width="40" height="4" fill="#cbd5e1" />
              <rect x={x + 9} y="67" width="35" height="4" fill="#cbd5e1" />
            </g>
          ))}
        </>
      ) : (
        <>
          {[24, 49, 74].map((y) => (
            <g key={y}>
              <rect x="24" y={y} width="192" height="18" rx="4" fill="white" />
              <rect
                x="34"
                y={y + 6}
                width={type === "form" ? 65 : 145}
                height="5"
                rx="2"
                fill="#cbd5e1"
              />
            </g>
          ))}
        </>
      )}
    </svg>
  );
}
export function SectionLibrary({
  existing,
  onAdd,
  onClose,
}: {
  existing: Set<string>;
  onAdd: (b: VisualBlock) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  return (
    <section
      className="visual-library visual-panel"
      role="dialog"
      aria-label="Add a branded section"
    >
      <header>
        <div>
          <h2>Add a section</h2>
          <p>
            Ready-made sections that match your website and adapt to mobile.
          </p>
        </div>
        <button onClick={onClose}>Close</button>
      </header>
      <input
        autoFocus
        aria-label="Search sections"
        placeholder="Search sections"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="visual-section-grid">
        {sectionPresets
          .filter((p) =>
            `${p.name} ${p.description}`
              .toLowerCase()
              .includes(q.toLowerCase()),
          )
          .map((p) => (
            <button
              key={p.name}
              disabled={!!p.kind && existing.has(p.kind)}
              onClick={() => {
                onAdd(createSection(p));
                onClose();
              }}
            >
              <SectionThumbnail type={p.thumbnail} />
              <strong>{p.name}</strong>
              <small>
                {p.kind && existing.has(p.kind)
                  ? "Already on this page — click it to edit."
                  : p.description}
              </small>
            </button>
          ))}
      </div>
      <h3>Individual blocks</h3>
      <p>Click to add a block at the end of the page. Select it to edit its content.</p>
      <div className="visual-basic-blocks">
        {visualTypes.filter(type => type !== "Website" && offeredTypes.has(type) &&
          (basicConfig.components[type].label ?? type).toLowerCase().includes(q.toLowerCase())
        ).map(type => <button key={type} onClick={() => {
          onAdd(block(type, structuredClone(basicConfig.components[type].defaultProps ?? {})));
          onClose();
        }}>Add {basicConfig.components[type].label ?? type}</button>)}
      </div>
    </section>
  );
}
