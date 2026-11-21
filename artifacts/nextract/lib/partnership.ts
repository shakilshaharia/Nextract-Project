/**
 * Copy for the Partnership page ("Nextract for accountants & CPA firms").
 */
import { links } from "./site";

export const partnershipMeta = {
  title: "Nextract for Accountants & CPA Firms",
  description:
    "Explore two ways accountants can work with Nextract. Refer clients and earn 15% recurring revenue share, or use AI-powered document processing in your practice.",
};

export const partnershipHero = {
  eyebrow: "Nextract for accountants & CPA firms",
  titleLead: "You help clients make sense of the numbers.",
  titleTrail: "Help them spend less time preparing them.",
  subtitle:
    "Whether you manage client AP or advise finance teams, help them process supplier invoices, review PO variances and follow up on exceptions — with less manual work.",
  offers: [
    { icon: "/images/partnership/piggy.svg", value: "15%", suffix: "Lifetime", label: "Revenue share on eligible referrals" },
    { icon: "/images/partnership/hourglass.svg", value: "2 months", label: "Free trial for every client or partner you refer" },
  ],
  cta: { label: "Explore the two ways to partner", href: "#paths" },
};

export const whyNextract = {
  eyebrow: "The work you know",
  title: "Spend less time on invoice entry. More time on the exceptions.",
  subtitle:
    "Nextract supports AP processing, PO matching and exception review — so finance teams can focus on what needs a decision.",
  cards: [
    {
      icon: "/images/partnership/why-extract.svg",
      title: "Invoice capture without rekeying",
      description:
        "Extract invoice headers and line items, PO references, supplier details and goods received notes.",
    },
    {
      icon: "/images/partnership/why-spot.svg",
      title: "PO-to-invoice variance checks",
      description: "Flag unit-price, quantity, tax and vendor mismatches before posting or approval.",
    },
    {
      icon: "/images/partnership/why-ai.svg",
      title: "AI-supported exception review",
      description: "See why an invoice was flagged, the variance involved, and suggested follow-up checks.",
    },
  ],
  exampleLabel: "For example",
  exampleText:
    "A client receives 300 supplier invoices a month. Their AP clerk checks PO numbers, unit prices and quantities by hand. With Nextract, extracted values are compared with the PO, and only variances need investigation — so the AP lead can follow up with the supplier before approving the invoice.",
};

export const partnershipPaths = {
  eyebrow: "The partnership, your way",
  title: "Two ways Nextract can work for your firm.",
  subtitle:
    "Refer businesses with high invoice volumes, or use Nextract in your own bookkeeping, outsourced AP and finance operations.",
  tabs: [
    {
      id: "refer",
      label: "Refer Nextract to clients",
      sub: "15% recurring revenue share on paying referrals",
      steps: [
        {
          num: "01 · Introduce",
          title: "Identify the right clients",
          text: "Identify clients still keying supplier invoices and matching POs in spreadsheets.",
        },
        {
          num: "02 · Pilot",
          title: "Every new user gets two months at no cost",
          text: "Every new user receives two months at no cost to test Nextract with their own documents.",
        },
        {
          num: "03 · Earn",
          title: "Build recurring income",
          text: "Earn 15% lifetime recurring revenue share on eligible referred accounts while they remain paying subscribers.",
        },
      ],
      outcome: {
        strong: "New income, built around the client relationships you already have.",
        note: "Commission terms subject to the partner agreement.",
      },
    },
    {
      id: "use",
      label: "Use Nextract in your practice",
      sub: "Reduce rekeying and AP exception-review time",
      steps: [
        {
          num: "01 · Bring the work",
          title: "Bring client documents in",
          text: "Bring your clients’ invoices, POs and receiving notes into the AP workflow.",
        },
        {
          num: "02 · Review the right things",
          title: "Let AI surface issues",
          text: "Review price/quantity variances and missing PO references with AI explanations.",
        },
        {
          num: "03 · Use your time better",
          title: "Focus on client work",
          text: "Spend less time rekeying documents and chasing discrepancies; more time on close review and advisory work.",
        },
      ],
      outcome: {
        strong: "More capacity for the work clients actually value.",
        note: "This route offers operational value, not automatic referral commission.",
      },
    },
  ],
} as const;

export const earningsCalculator = {
  eyebrow: "Lifetime Partner Earnings Calculator",
  title: "See What Your Lifetime Revenue Share Could Earn.",
  subtitle:
    "Explore the potential of 15% lifetime revenue share on paying referrals, based on each client's plan and document volume.",
  commission: 0.15,
  defaultTier: "business",
  tiers: [
    { id: "starter", name: "Starter", base: 49, includes: 100, extra: 0.35, blurb: "$49/month · 100 documents included" },
    { id: "business", name: "Business", base: 99, includes: 500, extra: 0.35, blurb: "$99/month · 500 documents included" },
    { id: "pro", name: "Pro", base: 199, includes: 800, extra: 0.45, blurb: "$199/month · 800 documents included" },
  ],
  disclaimer:
    "Illustrative, not guaranteed. The 5-year estimate represents 60 paying months after the two-month trial at no cost and assumes all referred clients remain subscribed at the same plan and document volume. Commission is modelled as 15% of base subscription plus overages; actual eligibility and the commission basis are subject to the partner agreement.",
  featureColumns: ["Starter", "Business", "Pro"],
  featureRows: [
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
    { label: "Additional Document (Over Allowance)", values: ["$0.35", "$0.35", "$0.45"] },
  ],
} as const;

export const pilot = {
  eyebrow: "Try Nextract at No Cost",
  title: "Two Months at No Cost for Every New User.",
  text: "Every new Nextract user gets two months to try the platform at no cost, whether they sign up directly or through a partner. Use your own supplier invoices, review PO discrepancies, and explore AI exception summaries before deciding on a paid plan. Pilot scope and onboarding support can be confirmed by our team.",
};

export const partnershipFaq = {
  eyebrow: "The essentials",
  title: "Questions accountants usually ask.",
  items: [
    {
      q: "Who is this partnership designed for?",
      a: "CPA firms, accounting and bookkeeping practices, outsourced finance teams, and solo practitioners working with clients who handle document-heavy finance processes.",
    },
    {
      q: "How does the 15% revenue share work?",
      a: "Eligible referrals that convert to paying accounts generate a 15% recurring revenue share. Whether overage charges qualify, and other terms, are defined by the partner agreement.",
    },
    {
      q: "Do my clients have to purchase after the pilot?",
      a: "Every referred client or partner gets two months to try Nextract at no cost. After that, they can choose whether to move to a paid subscription. Usage limits and onboarding scope will be confirmed before the trial.",
    },
    {
      q: "Can I use Nextract directly in my own accounting services?",
      a: "Yes, that's a second use case worth discussing. It can help with invoice data capture and exception review within the work your team already delivers. Pricing and access for that use are discussed separately from referral commission.",
    },
  ],
};

export const registerSection = {
  eyebrow: "Let’s make it practical",
  title: "Bring less paperwork into your AP workflow.",
  text: "Refer clients and earn 15% recurring revenue share, or use Nextract to process invoices and exceptions for the businesses you serve.",
  highlights: [
    "15% recurring revenue share for eligible referrals.",
    "Every referred client or partner gets two free months to try Nextract.",
  ],
  form: {
    title: "Explore a Nextract Partnership",
    subtitle: "Share your details to explore 15% lifetime revenue share or your two-month trial at no cost.",
    interestOptions: ["Refer Nextract to clients", "Use Nextract in my practice", "Explore both"],
    submit: "Register My Interest",
    consent:
      "By registering, you agree to be contacted about the Nextract partnership opportunity. Add the approved privacy-policy link before publishing.",
  },
  contactHref: links.contact,
};
