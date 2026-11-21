/**
 * Copy for the Pricing page ("Document Intelligence That Fits Your Workflow and Your Budget").
 */
import { links } from "./site";

export const pricingMeta = {
  title: "Pricing",
  description:
    "Explore Nextract pricing for AI document capture, invoice matching and exception intelligence. Starter, Business and Pro plans.",
};

export const pricingHero = {
  eyebrow: "Nextract Pricing",
  title: "Document Intelligence That Fits Your Workflow and Your Budget.",
  subtitle:
    "From invoice capture to AI-powered exception insights, choose the plan that fits your document volume and the work your finance team needs to get done.",
};

export const plans = [
  {
    id: "starter",
    name: "Starter",
    description: "Get routine document capture and AP checks moving.",
    price: "$49",
    period: "/ month",
    allowanceValue: "100",
    allowanceLabel: "Documents Included / Month",
    allowanceNote: "$0.35 per additional document",
    cta: { label: "Get Started", href: links.contact },
    featured: false,
    points: [
      "AP & AR Data Capture",
      "Smart Data Validation & Review",
      "Duplicate & Error Detection",
      "2-Way Invoice Matching",
      "Basic Financial Reporting Dashboard",
    ],
  },
  {
    id: "business",
    name: "Business",
    badge: "More Documents, More Control",
    description: "Add goods-receipt checks for a busier AP workload.",
    price: "$99",
    period: "/ month",
    allowanceValue: "500",
    allowanceLabel: "Documents Included / Month",
    allowanceNote: "$0.35 per additional document",
    cta: { label: "Get Started", href: links.contact },
    featured: true,
    points: [
      "Everything in Starter",
      "3-Way Invoice Matching",
      "Advanced Financial Reporting Dashboard",
      "Accounting & ERP Integration",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    description: "Go further with AI explanations and exception intelligence.",
    price: "$199",
    period: "/ month",
    allowanceValue: "800",
    allowanceLabel: "Documents Included / Month",
    allowanceNote: "$0.45 per additional document",
    cta: { label: "Get Started", href: links.contact },
    featured: false,
    points: [
      "Everything in Business",
      "AI-Powered Discrepancy Explanations",
      "Invoice Dispute & Exception Management",
      "Automated Document Reconciliation",
      "Ask AI About Your Financial Data",
    ],
  },
] as const;

export const plansNote =
  "All prices shown in USD. Plan fees are monthly; usage above the included document allowance is billed per additional document. Confirm applicable taxes and contract terms with Nextract.";

export const planComparison = {
  eyebrow: "Plan Comparison",
  title: "Compare What's Included.",
  subtitle: "The capabilities that matter to AP and finance teams, without the feature overload.",
  columns: ["Starter", "Business", "Pro"],
  rows: [
    { label: "AP & AR Data Capture", values: [true, true, true] },
    { label: "Smart Data Validation & Review", values: [true, true, true] },
    { label: "Duplicate & Error Detection", values: [true, true, true] },
    { label: "Accounting & ERP Integration", values: [true, true, true] },
    { label: "Financial Reporting Dashboard", values: ["Basic", "Advanced", "Advanced"] },
    { label: "2-Way Invoice Matching", values: [true, true, true] },
    { label: "3-Way Invoice Matching", values: [false, true, true] },
    { label: "Invoice Dispute & Exception Management", values: [false, false, true] },
    { label: "AI-Powered Discrepancy Explanations", values: [false, false, true] },
    { label: "Automated Document Reconciliation", values: [false, false, true] },
    { label: "Ask AI About Your Financial Data", values: [false, false, true] },
    { label: "Documents Included / Month", values: ["100", "500", "800"] },
    { label: "Monthly Base Price", values: ["$49", "$99", "$199"] },
    { label: "Additional Document", values: ["$0.35", "$0.35", "$0.45"] },
  ],
} as const;

export const competitorComparison = {
  eyebrow: "Compare Solutions",
  title: "How Nextract Compares.",
  subtitle:
    "See how Nextract compares across document intelligence, matching, and exception handling.",
  columns: ["Capability", "Nextract", "DASH AP Robot", "SAP Concur", "AvidXchange", "Medius", "Yooz"],
  rows: [
    {
      label: "Primary Focus",
      values: [
        "AI-powered document intelligence, validation, and workflow automation across industries",
        "AP automation for manufacturing and distribution",
        "Enterprise AP and expense workflows",
        "AP and payment automation",
        "AP automation and invoice processing",
        "AP and payment automation",
      ],
    },
    {
      label: "AI Discrepancy Guidance",
      values: [
        "AI explains why documents do not match, identifies risks, and recommends next-best actions",
        "Exception flagging; AI guidance not publicly documented",
        "AI assistance varies by workflow",
        "AI assistance varies by workflow",
        "AI-supported discrepancy detection",
        "AI-assisted discrepancy resolution",
      ],
    },
    {
      label: "AI-Driven Document Q&A",
      values: [
        "Ask AI agent about extracted fields, mismatches, matching results, and analytics",
        "Not publicly documented",
        "Not publicly documented",
        "Not publicly documented",
        "Copilot supports contextual invoice queries",
        "AI assistant supports selected queries",
      ],
    },
    {
      label: "Standalone PO, Invoice, Receipt Matching",
      values: [
        "Standalone or ERP-connected 2-way and 3-way matching, with line-level validation and multi-invoice PO balance tracking",
        "ERP-connected 3-way matching",
        "PO/receipt data through existing workflows",
        "ERP-connected matching workflows",
        "AI-supported PO, invoice, and receipt matching",
        "PO, invoice, and receipt processing",
      ],
    },
    {
      label: "Service & Freight Exceptions",
      values: [
        "Service/SOW validation, billing-period checks, freight charges, and shipment exceptions",
        "Dedicated workflows not publicly documented",
        "May require configuration",
        "May require configuration",
        "Contract-based checks available",
        "May require configuration",
      ],
    },
    {
      label: "Integration Approach",
      values: [
        "Designed to integrate with different ERP/CRM platforms via supported connectors or APIs; specific integrations require configuration",
        "SYSPRO and industrial ERP integrations",
        "Enterprise AP and expense system integrations",
        "ERP-connected AP workflows",
        "ERP-integrated AP automation",
        "AP and payment platform integrations",
      ],
    },
  ],
  caveat:
    "Comparison reflects product information available at the time of publication. Features and integrations may vary by version or configuration. “Not publicly documented” does not necessarily mean unavailable.",
} as const;

export const pricingWhy = {
  eyebrow: "Why Nextract",
  title: "More Than Document Extraction.",
  subtitle:
    "Nextract helps teams move from captured information to a reviewable next step, alongside the systems they already use.",
  cards: [
    {
      icon: "/images/partnership/why-spot.svg",
      title: "Make Sense of Exceptions",
      description:
        "Spot invoice-to-PO discrepancies, review variances and use AI explanations to understand what needs attention.",
    },
    {
      icon: "/images/partnership/why-extract.svg",
      title: "Handle Real-World Documents",
      description:
        "Work with invoices, purchase orders and goods receipts—including complex layouts, partial invoicing and different business requirements.",
    },
    {
      icon: "/images/partnership/why-control.svg",
      title: "Keep Your Existing Systems",
      description:
        "Validate and review data before publishing to a connected ERP or CRM. Integration requirements depend on your system.",
    },
  ],
};

export const pricingTrial = {
  eyebrow: "Try Nextract at No Cost",
  title: "Start With Two Months at No Cost.",
  text: "Explore Nextract with your own documents and see which workflows it can simplify before choosing a paid plan. Trial scope and onboarding details are confirmed by the Nextract team.",
  cta: { label: "Ask About Your No-Cost Trial", href: links.contact },
};

export const pricingFaq = {
  eyebrow: "Frequently Asked Questions",
  title: "Know Before You Choose.",
  items: [
    {
      q: "What happens if I exceed my monthly document allowance?",
      a: "Documents above your plan allowance are charged at the per-document rate shown for your plan.",
    },
    {
      q: "Does Nextract replace my ERP or accounting system?",
      a: "No. Nextract is designed to capture, validate and review document data before publishing to supported connected systems. Integration scope depends on your current software and configuration.",
    },
    {
      q: "What is the difference between 2-way and 3-way matching?",
      a: "2-way matching compares a supplier invoice with a purchase order. 3-way matching also checks goods receipt information, helping verify what was actually received.",
    },
    {
      q: "Does Nextract automatically approve exceptions?",
      a: "Nextract can highlight discrepancies and provide AI explanations or suggested actions. Review and approval remain subject to the configured workflow and human oversight.",
    },
  ],
  footnote:
    "Capabilities and integration details may vary by deployment. Contact Nextract to confirm availability for your intended workflow.",
};
