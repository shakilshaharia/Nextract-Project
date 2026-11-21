/**
 * Copy for the Privacy Policy, Terms & Conditions, Contact, and 404 pages,
 * transcribed verbatim from the Figma frames.
 */

export type LegalSection = {
  id: string;
  heading: string;
  paragraphs: string[];
  points: string[];
};

export type LegalPage = {
  eyebrow: string;
  title: string;
  subtitle: string;
  /** Prefix section headings with "1.", "2." … and use "Notes:" instead of "Key Points:". */
  numbered: boolean;
  pointsLabel: string;
  sections: LegalSection[];
  footnote?: { label: string; text: string };
};

export const privacyPolicy: LegalPage = {
  eyebrow: "Last Updated 12 Jul 2025",
  title: "Privacy Policy",
  subtitle:
    "This Privacy Policy describes Our policies and procedures on the collection, use and disclosure of Your information.",
  numbered: false,
  pointsLabel: "Key Points:",
  sections: [
    {
      id: "information-we-collect",
      heading: "Information We Collect from All Our Users",
      paragraphs: [
        "We collect data to operate efficiently and deliver a seamless, personalized coding experience. This includes personally identifiable information such as your name, email address, and billing information when you sign up or subscribe. Additionally, we collect usage data, such as IP addresses, device type, browser type, visited pages, clicked elements, session durations, and crash reports. Since our product is a code editor, we also collect the code or project data you upload or create on the platform to ensure editor functionality and user experience.",
        "This data helps us troubleshoot issues, enhance features, and tailor the platform to your needs. We only collect data relevant to your interaction with the platform and do not collect unnecessary personal information. All data is securely stored and processed in compliance with international data laws.",
      ],
      points: [
        "Personal info like name, email, and profile details",
        "Code or project data shared via the editor",
        "Device, browser, and usage behavior logs",
      ],
    },
    {
      id: "how-we-use-data",
      heading: "How We Use the Data You Provide",
      paragraphs: [
        "The data we collect is used to enhance your experience, ensure platform stability, and help our AI systems deliver smarter suggestions. Your personal data enables us to maintain your account, handle subscriptions, and provide essential communications. Usage analytics and behavioral patterns help us understand how the platform is being used so we can optimize performance and introduce meaningful updates. If you're using our Smart AI Code Editor, real-time suggestions and autocomplete features depend on temporary contextual data to assist you intelligently.",
        "We never use your code for external training or analysis without consent. The insights we gain from your interaction with our tools help us personalize the platform and make it smarter with every session.",
      ],
      points: [
        "Generate personalized AI code suggestions based on interaction",
        "Optimize platform features using real-time feedback and usage",
        "Improve stability and prevent unauthorized access",
      ],
    },
    {
      id: "protecting-your-code",
      heading: "Protecting Your Code and Project Data",
      paragraphs: [
        "Your code is your intellectual property, and protecting it is our highest priority. Any code or files uploaded to our platform remain strictly private and are never accessible to unauthorized personnel or used for model training without explicit permission. All code data is encrypted both in transit and at rest using industry-standard protocols. You work in isolated and secure execution environments designed for privacy, stability, and compliance.",
      ],
      points: [
        "End-to-end encryption for stored and transmitted code",
        "Private environment for secure code execution",
        "Code never used to train AI models without consent",
      ],
    },
    {
      id: "sharing-data",
      heading: "Sharing Data with Third-Party Service Providers",
      paragraphs: [
        "We rely on a limited set of trusted third-party services to operate essential functions of our platform, such as cloud hosting, payment processing, error tracking, and analytics. These providers are contractually bound to handle your data in accordance with strict data protection agreements and are only given access to the minimum data necessary to perform their functions.",
        "We do not sell, rent, or otherwise share your personal data with third parties for advertising or marketing purposes. Examples of third parties may include Google Analytics, Stripe for payment processing, and secure cloud providers like AWS or Google Cloud.",
      ],
      points: [
        "End-to-end encryption for stored and transmitted code",
        "Private environment for secure code execution",
        "Code never used to train AI models without consent",
      ],
    },
    {
      id: "cookies",
      heading: "How We Use Cookies and Tracking Tools",
      paragraphs: [
        "Cookies help personalize your experience and track feature performance. We use only essential and analytics cookies. You can control your preferences through browser settings or our cookie banner.",
      ],
      points: [
        "Session cookies used to remember login and settings",
        "Analytics cookies improve editor speed and features",
        "No advertising or marketing tracking without consent",
      ],
    },
    {
      id: "security-practices",
      heading: "Security Practices to Keep Your Data Safe",
      paragraphs: [
        "We implement strict security measures including data encryption, secure authentication, and regular system audits to protect your information from unauthorized access or misuse.",
      ],
      points: [
        "SSL/TLS encryption for all transmitted data",
        "Two-factor authentication to secure user accounts",
        "Internal access control and staff confidentiality policies",
      ],
    },
    {
      id: "future-changes",
      heading: "Future Changes to This Privacy Policy Document",
      paragraphs: [
        "We may occasionally update this policy to reflect new features or legal requirements. You’ll be notified of significant changes via email or dashboard alert.",
      ],
      points: [
        "SSL/TLS encryption for all transmitted data",
        "Two-factor authentication to secure user accounts",
        "Internal access control and staff confidentiality policies",
      ],
    },
  ],
};

export const termsConditions: LegalPage = {
  eyebrow: "Last Updated 12 Jul 2025",
  title: "Terms & Condition",
  subtitle: "Understand your rights, responsibilities, and usage rules when using our AI Agents.",
  numbered: true,
  pointsLabel: "Notes:",
  sections: [
    {
      id: "use-responsibly",
      heading: "Use the Platform Responsibly and Within Legal Boundaries",
      paragraphs: [
        "Our platform is built for productive, professional development. You agree not to use it for unlawful, malicious, or harmful purposes. Activities such as reverse engineering, hacking, or uploading dangerous code are strictly prohibited and may lead to account suspension without notice.",
      ],
      points: [
        "Misuse or illegal activity will result in immediate account action",
        "Use tools only for ethical, constructive development",
      ],
    },
    {
      id: "account-security",
      heading: "Maintain Security of Your Account at All Times",
      paragraphs: [
        "You are solely responsible for protecting your login credentials and account activity. Do not share your password or grant access to unauthorized users. If suspicious behavior is detected, notify our team immediately to help secure your account and data.",
      ],
      points: [
        "Never share passwords or editor access with others",
        "Report unauthorized activity immediately for security",
      ],
    },
    {
      id: "subscriptions",
      heading: "Understand Subscription Tiers, Renewals, and Billing",
      paragraphs: [
        "We offer free and paid plans with recurring billing. You’ll be notified before renewal. You can cancel anytime via your dashboard. Refunds are only issued per our published refund policy. Failure to pay may result in limited access or account suspension.",
      ],
      points: [
        "Subscription renewals occur automatically unless canceled",
        "Cancel anytime from your dashboard with no penalty",
      ],
    },
    {
      id: "code-ownership",
      heading: "You Retain Full Ownership of Your Code",
      paragraphs: [
        "Any code you upload, write, or store on our platform remains entirely yours. We do not claim rights, reuse it, or feed it into AI training systems unless you give explicit permission. Your intellectual property is protected by design and policy.",
      ],
      points: [
        "Your code is never used to train AI models",
        "You own all uploaded and generated content",
      ],
    },
    {
      id: "feature-changes",
      heading: "We May Improve, Update, or Remove Features Anytime",
      paragraphs: [
        "To deliver the best experience, we may change or remove platform features. We’ll try to notify users in advance of major changes. Some updates may temporarily affect performance, but they're always made to improve security, stability, or functionality.",
      ],
      points: [
        "Features may change without prior notice in some cases",
        "Updates help us keep the editor secure and fast",
      ],
    },
    {
      id: "manual-review",
      heading: "Generated Code Requires Manual Review by Users",
      paragraphs: [
        "Our AI provides smart suggestions and code completions, but users must verify everything before using it in production. We are not liable for any bugs, inefficiencies, or security risks introduced by AI-generated code.",
      ],
      points: [
        "AI is an assistant, not a replacement for best practices",
        "Always test generated code before deployment",
      ],
    },
    {
      id: "termination",
      heading: "We Reserve the Right to Terminate Violating Accounts",
      paragraphs: [
        "Accounts violating these terms may be suspended or permanently removed. We aim to warn users first, but serious offenses may result in immediate action to protect platform integrity and user safety.",
      ],
      points: [
        "Repeated or severe violations will lead to permanent suspension",
        "Follow rules to ensure uninterrupted access and support",
      ],
    },
  ],
  footnote: {
    label: "Final Note:",
    text: "By signing up or using Smart AI Chat, you agree to abide by these terms. If you do not agree, please do not use the platform.",
  },
};

export const contact = {
  title: "Let's Talk Documents",
  subtitle:
    "Have questions about Nextract or a document workflow you'd like to improve? We'd love to hear from you.",
  form: {
    heading: "Get in touch with us",
    firstName: "First Name *",
    lastName: "Last Name *",
    email: "Work Email *",
    company: "Company Name *",
    jobTitle: "Job Title *",
    phonePlaceholder: "Phone Number",
    message:
      "E.g., We're looking to reduce manual invoice entry and improve PO matching and exception handling across our AP workflows.",
    consent: "I'd like to receive product updates and insights from Nextract.",
    submit: "Submit Message",
  },
  cards: [
    {
      icon: "chat",
      title: "Talk to Our Team",
      description: "Explore how Nextract could fit your business.",
      value: "connect@nextract.ca",
    },
    {
      icon: "location",
      title: "Visit Our Office",
      description: "Find us in downtown Toronto.",
      value: "25 Adelaide St E, Suite 1100",
    },
    {
      icon: "phone",
      title: "Call Our Team",
      description: "Have questions about Nextract? Let's talk.",
      value: "+1 (877) 797-0406",
    },
  ] as const,
};

export const notFound = {
  title: "Page Not Found",
  description:
    "The page you’re looking for doesn’t exist or has been moved. Try heading back to the homepage or explore other sections.",
};

export const aboutPage = {
  eyebrow: "About Nextract",
  title: "About Us",
  subtitle:
    "Nextract helps finance and operations teams turn document-heavy work into validated, decision-ready data.",
  story: {
    heading: "Built for the work behind every business decision",
    paragraphs: [
      "Every business runs on documents — invoices, purchase orders, receiving notes, and the records that tie them together. Too often that information is re-keyed by hand, checked line by line, and still slips through with errors.",
      "Nextract was built to change that. We move documents through a structured workflow — capture, extract, validate, match, and review — so teams go from incoming information to clean, trustworthy data without the manual grind.",
      "Today, finance and operations teams use Nextract to process more documents in less time, catch discrepancies earlier, and keep their people focused on the decisions that actually need a person.",
    ],
  },
  values: [
    {
      title: "Accuracy first",
      description:
        "We surface confidence, quality, and missing information so you can trust the data before it moves forward.",
    },
    {
      title: "Built for teams",
      description:
        "Nextract fits into the processes your finance and operations teams already run, instead of replacing them.",
    },
    {
      title: "Secure by design",
      description:
        "Your documents stay private and protected, handled with the controls enterprise teams expect.",
    },
    {
      title: "Always improving",
      description:
        "We keep refining extraction and matching so the platform gets sharper with every document.",
    },
  ],
} as const;

export const resourcesPage = {
  eyebrow: "Resources",
  title: "Ideas and insights for every customer moment.",
  subtitle:
    "Explore practical guidance, success stories, and events on automating document and invoice processing.",
  sectionTitle: "Explore our resources",
  filters: ["All", "Blogs", "Success Stories", "Events"],
  searchLabel: "Search resources",
  items: [
    {
      category: "Success Stories",
      meta: "Success story · Wholesale distribution",
      title:
        "How a North American Wholesaler Standardized Invoice Processing Across 200+ Suppliers",
      description:
        "200+ suppliers and 4,500 monthly invoices, standardized into one workflow that cut invoice processing time by 60%.",
      href: "/success-stories/north-american-wholesaler-invoice-processing",
      image: "/images/success-stories/wholesaler-snapshot.png",
    },
    {
      category: "Success Stories",
      meta: "Success story · Retail",
      title: "How a North American Retailer Automated PO, Invoice, and Delivery Matching",
      description:
        "PO, invoice, shipping, and receiving records connected into one matching workflow that cut reconciliation time by 61%.",
      href: "/success-stories/north-american-retailer-po-invoice-delivery-matching",
      image: "/images/success-stories/retailer-impact.png",
    },
    {
      category: "Success Stories",
      meta: "Success story · Manufacturing",
      title: "How a North American Manufacturer Standardized Multi-Currency Supplier Invoices",
      description:
        "2,700 monthly invoices across six currencies, standardized with approved exchange rates to cut currency corrections 44%.",
      href: "/success-stories/north-american-manufacturer-multi-currency-invoices",
      image: "/images/success-stories/manufacturer-impact.png",
    },
    {
      category: "Success Stories",
      meta: "Success story · Construction",
      title: "How a North American Construction Company Built a Centralized Vendor Intelligence Hub",
      description:
        "Invoices, POs, subcontracts, and deliveries connected into one vendor intelligence hub that cut research time 78%.",
      href: "/success-stories/north-american-construction-vendor-intelligence-hub",
      image: "/images/success-stories/construction-impact.png",
    },
    {
      category: "Events",
      meta: "Event · Nov 3–4, 2026",
      title: "Nextract is Coming to Accountex Canada 2026",
      description:
        "Meet us at Accountex Canada 2026 in Toronto to see AI-powered document extraction, matching, and review in action.",
      href: "/events/nextract-at-accountex-canada-2026",
      image: "/images/events/accountex-canada-2026.png",
    },
  ],
} as const;
