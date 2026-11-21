/**
 * Page copy, transcribed verbatim from the Figma Home frame (node 6504:397).
 * Keep wording in sync with the design file rather than editing it here.
 */
import { links } from "./site";
import { sectionMedia } from "./section-media";

export const hero = {
  media: sectionMedia,
  titleLead: "Make your documents",
  titleTrail: "reveal what matters.",
  description:
    "Nextract helps teams process invoices, POs, contracts, work orders, and more. From data extraction and validation to document matching, exception handling, AI insights, and integration with existing systems.",
  cta: { label: "See Nextract in Action", href: links.contact },
};

export const brandStrip = {
  text: "Trusted by companies and partners around the world",
  // Grayscale client logos, scrolled in a slow marquee loop.
  logos: [
    { name: "Ahold Delhaize", src: "/images/clients-grayscale/ahold-delhaize.png", width: 110, height: 40 },
    { name: "Canadian Tire", src: "/images/clients-grayscale/canadian-tire.png", width: 45, height: 40 },
    { name: "Canpar Express", src: "/images/clients-grayscale/canpar-express.png", width: 133, height: 40 },
    { name: "Charger Logistics", src: "/images/clients-grayscale/charger-logistics.png", width: 96, height: 40 },
    { name: "Deloitte", src: "/images/clients-grayscale/deloitte.png", width: 200, height: 40 },
    { name: "Empire Company", src: "/images/clients-grayscale/empire-company.png", width: 148, height: 40 },
    { name: "Hudson's Bay", src: "/images/clients-grayscale/hudsons-bay.png", width: 158, height: 40 },
    { name: "Lakeshore", src: "/images/clients-grayscale/lakeshore.png", width: 79, height: 40 },
    { name: "Meta", src: "/images/clients-grayscale/meta.png", width: 93, height: 40 },
    { name: "Pernod Ricard", src: "/images/clients-grayscale/pernod-ricard.png", width: 109, height: 40 },
    { name: "Pet Valu", src: "/images/clients-grayscale/pet-valu.png", width: 120, height: 40 },
    { name: "Riverside Natural Foods", src: "/images/clients-grayscale/riverside-natural-foods.png", width: 116, height: 40 },
    { name: "Royal Building Products", src: "/images/clients-grayscale/royal-building-products.png", width: 91, height: 40 },
    { name: "Scene+", src: "/images/clients-grayscale/scene.png", width: 129, height: 40 },
    { name: "Sobeys", src: "/images/clients-grayscale/sobeys.png", width: 107, height: 40 },
  ],
};

export const stats = [
  { value: "90%", label: "Faster processing" },
  { value: "23×", label: "More invoices processed per" },
  { value: "70%", label: "Higher operational" },
  { value: "10k+ hrs", label: "Manual work eliminated" },
  { value: "60%+", label: "Fewer errors" },
];

export type WorkflowStep = {
  id: string;
  label: string;
  icon: string;
  /** Index of the designed panel to show. */
  panel: number;
};

export const workflow = {
  title: "From incoming document to actionable data",
  description:
    "Nextract brings document processing, validation, matching, and exception handling into one connected workflow. Reduce manual effort while keeping your team in control of the decisions that matter.",
  steps: [
    { id: "capture", label: "Capture", icon: "/images/icons/cube-focus.svg", panel: 0 },
    { id: "extract", label: "Extract", icon: "/images/icons/note.svg", panel: 1 },
    { id: "validate", label: "Validate", icon: "/images/icons/check-circle.svg", panel: 2 },
    { id: "match", label: "Match", icon: "/images/icons/graph.svg", panel: 3 },
    { id: "review", label: "Review", icon: "/images/icons/file-search.svg", panel: 4 },
  ] satisfies WorkflowStep[],
  panels: [
    {
      title: "Bring every document into one intelligent flow",
      description:
        "Collect invoices, POs, GRNs, contracts, work orders, shipment records, and other industry-specific documents from multiple sources.",
      impact: "Less manual collection and a faster start to every process.",
      icon: "/images/workflow/capture-icon.png",
      illustration: "/images/workflow/capture-illustration.png",
      animation: "/animations/capture.json",
      media: sectionMedia,
      illustrationAlt:
        "DOC, PNG, JPG, PPT and PDF files arranged around a central check mark",
    },
    {
      title: "Turn documents into usable business data",
      description:
        "Use AI to capture suppliers, references, dates, quantities, rates, amounts, taxes, and line items. Process supported English, French, multi-page, and handwritten documents.",
      impact: "Less data entry and more time for valuable work.",
      icon: "/images/workflow/extract-icon.png",
      illustration: "/images/workflow/extract-illustration.png",
      animation: "/animations/extract.json",
      media: sectionMedia,
      illustrationAlt:
        "A document with Vendor, PO Number, Quantity, Subtotal Amount and Total Amount fields extracted",
    },
    {
      title: "Know what you can trust",
      description:
        "Check extracted information for missing fields, low-confidence values, inconsistencies, and other issues before data moves forward.",
      impact: "Better data quality and fewer downstream errors.",
      icon: "/images/workflow/validate-icon.png",
      illustration: "/images/workflow/validate-illustration.png",
      animation: "/animations/validate.json",
      media: sectionMedia,
      illustrationAlt:
        "Validation network with three approved checks and one warning connected to a central data store",
    },
    {
      title: "Find the differences without checking every line",
      description:
        "Compare information across related records using two-way and three-way matching, service billing validation, and other configured matching workflows.",
      impact: "Faster reconciliation and less manual checking.",
      icon: "/images/workflow/match-icon.png",
      illustration: "/images/workflow/match-illustration.png",
      animation: "/animations/match.json",
      media: sectionMedia,
      illustrationAlt: "A purchase order and an invoice side by side with matching lines connected",
    },
    {
      title: "Focus attention where it matters",
      description:
        "Route discrepancies and uncertain records to the right people. Review original documents, correct extracted values, and confirm information before publishing it to connected systems.",
      impact: "Faster decisions with human oversight where needed.",
      icon: "/images/workflow/review-icon.png",
      illustration: "/images/workflow/review-illustration.png",
      animation: "/animations/review.json",
      media: sectionMedia,
      illustrationAlt: "",
    },
  ],
};

export const solutions = {
  title: "Built around the work your teams already do",
  description:
    "Whether you're processing invoices, validating agreements, managing shipments, or handling industry-specific records, Nextract automates complex document workflows and adapts exception handling to the unique requirements of each industry.",
  invoices: {
    media: sectionMedia,
    title: "Service Invoice & SOW Validation",
    description:
      "Compare billed hours, rates, service periods, and milestones against agreed terms to identify billing discrepancies.",
  },
  automation: {
    media: sectionMedia,
    label: "Match Review",
    steps: ["Critical Risk", "Confidence 35%", "Match", "Price Mismatch"],
    title: "Three-Way Document Matching",
    description:
      "Compare invoices, POs, and GRNs to catch pricing, quantity, and receiving discrepancies without manual line-by-line checks.",
  },
  records: {
    image: { src: "/images/solutions/shipment-photo.jpg", alt: "Logistics documents, receipts and a calculator spread across a desk while a person reviews them" },
    media: sectionMedia,
    title: "Freight Invoice Processing & Charge Review",
    description:
      "Extract and review shipment details, billed weights, transportation rates, fuel surcharges, and additional charges.",
  },
  control: {
    title: "Human-in-the-Loop Review & Publishing",
    description:
      "Review flagged information, correct discrepancies, and publish validated data to connected business systems with human oversight.",
    confidenceLabel: "Extraction confidence",
    confidenceValue: "100%",
    rows: [
      { label: "Data Extraction", status: "Completed", tone: "muted" },
      { label: "AI Summary", status: "Ready", tone: "highlight" },
      { label: "Match Review", status: "Ready", tone: "muted" },
    ] as const,
  },
};

export const integrations = {
  video: "/videos/nextract-video.mp4",
  title: "Connect Nextract to the way your business already works",
  description:
    "Your documents shouldn’t create another disconnected process. Nextract turns incoming information into structured, validated data that can move through the systems and workflows your teams already rely on.",
  items: [
    {
      title: "Work with your existing stack",
      description:
        "Connect workflows with configured CRM, ERP, finance, procurement, and operational systems, including Salesforce and Sage.",
      width: 356,
    },
    {
      title: "Move cleaner data downstream",
      description:
        "Validate and review extracted information before publishing it to connected systems, reducing manual corrections and repeated data entry.",
      width: 379,
    },
    {
      title: "Keep information moving",
      description:
        "Move reviewed records into existing workflows without requiring teams to replace the tools and processes they already use.",
      width: 400,
    },
  ],
};

export const control = {
  title: "Stay in control at every step",
  description:
    "Nextract keeps document activity traceable, so your team can see what was processed, what changed, and how each review or decision was handled.",
  items: [
    {
      title: "Trace the history",
      description: "Follow document activity, corrections, and status changes.",
    },
    {
      title: "See who did what",
      description: "Keep user actions, reviews, and timestamps visible.",
    },
    {
      title: "Understand every exception",
      description:
        "Go back to the information behind a mismatch or review decision when you need it.",
    },
  ],
};

export const testimonials = {
  title: "Real results. Less manual document work.",
  description:
    "Join a growing community of traders, investors, and crypto enthusiasts who rely on our platform .",
  items: [
    {
      quote:
        "\"Most documents were routine, but our team still had to touch them. The opportunity was letting straightforward work move while people focused on exceptions.\"",
      stat: "66% of routine work moved automatically",
      statDescription:
        "Nextract helped reduce repetitive processing and direct human attention toward the documents that actually required review.",
      name: "Retail & Distribution",
      role: "1,000–5,000 employees",
    },
    {
      quote:
        "\"Our team was spending too much time reconciling invoices and checking information across documents. We needed the process to move faster without losing control.\"",
      stat: "61% faster reconciliation",
      statDescription:
        "Nextract reduced manual document work by extracting, validating, and matching information before it reached the review stage.",
      name: "Multi-Location Retail",
      role: "500–1,000 employees",
    },
  ],
};

export type FaqItem = { question: string; answer?: string };

export const faq = {
  title: "Frequently asked questions",
  subtitle: "Need answers? We’ve got you covered.",
  description:
    "Here are some of the most common questions people ask us. If you can’t find what you’re looking for, feel free to reach out!",
  cta: { label: "Contact us", href: links.contact },
  items: [
    {
      question: "What is Nextract?",
      answer:
        "Nextract is an AI-powered document processing platform that turns business documents from multiple sources into structured, validated data, helping teams automate document-heavy workflows and focus on exceptions that need attention.",
    },
    {
      question: "What types of documents can Nextract process?",
      answer:
        "Nextract works with the business documents your teams handle every day — invoices, purchase orders, goods receipt notes (GRNs), and other receiving and finance documents — capturing them from multiple sources into one connected process.",
    },
    {
      question: "Can Nextract compare invoices and purchase orders?",
      answer:
        "Yes. Nextract captures invoice data, compares it against the related purchase order, and surfaces mismatches in quantities, prices, vendors, and totals so your team can focus on the exceptions that actually need review.",
    },
    {
      question: "What happens when Nextract finds an exception?",
      answer:
        "When Nextract detects a discrepancy or a low-confidence field, it flags the document for review instead of letting it move forward, and keeps the underlying information and history available so your team can resolve it quickly.",
    },
    {
      question: "Does Nextract replace my ERP or CRM?",
      answer:
        "No. Nextract complements the systems you already use. It turns documents into structured, validated data that moves through the ERP, CRM, finance, and procurement tools your business already relies on.",
    },
    {
      question: "Can users review uncertain information?",
      answer:
        "Yes. Anything Nextract isn't confident about is routed to your team for review, with the original document and the extracted values side by side so reviewers can confirm or correct the information.",
    },
  ] satisfies FaqItem[],
};

export const demoCta = {
  image: { src: "/images/cta/app-preview.png", alt: "Nextract dashboard showing documents awaiting review and totals for documents, processed docs and records synced to CRM" },
  title: "See what Nextract finds in your documents",
  description:
    "Give Nextract a representative document set and see how it turns the information inside into structured, validated data ready for your next business process.",
  cta: { label: "Discuss Your Workflow", href: links.contact },
};

export type FooterLink = { label: string; href: string | null; icon?: string; badge?: string };

export const footer = {
  description:
    "We believe documents should drive decisions, not slow them down. Nextract turns complex information into accurate, actionable data with AI.",
  columns: [
    {
      title: "Page links",
      links: [
        { label: "Home", href: links.home },
        { label: "Partner", href: "/partnership" },
        { label: "Pricing", href: links.pricing },
        { label: "Blog", href: null },
        { label: "Contact us", href: links.contact },
      ],
    },
    {
      title: "Social media",
      links: [
        {
          label: "Linkedin",
          href: "http://linkedin.com/company/nextract-ai/",
          icon: "/images/icons/linkedin.svg",
        },
      ],
    },
  ] satisfies { title: string; links: FooterLink[] }[],
  copyright: "© 2026 - All Rights Reserved",
  legal: [
    { label: "Privacy Policy", href: links.privacy },
    { label: "Terms of Conditions", href: links.terms },
  ] satisfies FooterLink[],
};
