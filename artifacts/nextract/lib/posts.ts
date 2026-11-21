/**
 * Content for the Blog, Success Story and Event post (detail) pages.
 */

export type BodyBlock =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "quote"; text: string; cite?: string }
  | { kind: "image"; src: string; alt: string; width: number; height: number; caption?: string };

type BasePost = {
  slug: string;
  title: string;
  excerpt: string;
  /** Short label shown in the eyebrow, e.g. "6 min read" or "Webinar". */
  kicker: string;
  /** Optional banner shown at the top of the post. */
  image?: { src: string; alt: string; width: number; height: number };
  body: BodyBlock[];
  /** Optional FAQ accordion shown below the body. */
  faqs?: { question: string; answer: string }[];
};

export type BlogPost = BasePost & {
  type: "blog";
  tag: string;
  author: string;
  authorRole: string;
  date: string;
};

export type SuccessStoryPost = BasePost & {
  type: "success-story";
  industry: string;
  timeline: string;
  results: { value: string; label: string }[];
};

export type EventPost = BasePost & {
  type: "event";
  format: string;
  date: string;
  time: string;
  location: string;
  duration: string;
  speakers: { name: string; role: string }[];
};

export type Post = BlogPost | SuccessStoryPost | EventPost;

export const postTypeMeta = {
  blog: { label: "Blog", labelPlural: "Blogs", base: "/blog", eyebrow: "Blog" },
  "success-story": {
    label: "Success Story",
    labelPlural: "Success Stories",
    base: "/success-stories",
    eyebrow: "Success story",
  },
  event: { label: "Event", labelPlural: "Events", base: "/events", eyebrow: "Event" },
} as const;

export const postHref = (post: Post) => `${postTypeMeta[post.type].base}/${post.slug}`;

export const posts: Post[] = [
  // ---------- Success Stories ----------
  {
    type: "success-story",
    slug: "north-american-wholesaler-invoice-processing",
    title:
      "How a North American Wholesaler Standardized Invoice Processing Across 200+ Suppliers",
    excerpt:
      "See how a North American wholesale distributor standardized English and French supplier invoices, reduced manual data entry, and redirected $388,800 in annual finance capacity.",
    kicker: "Success story",
    image: {
      src: "/images/success-stories/wholesaler-snapshot.png",
      alt: "Case study snapshot — wholesale distribution, 13-week rollout: 60% faster invoice processing, 68% processed without manual re-entry, 675 hours recovered each month, and $388,800 in annual finance capacity redirected.",
      width: 2172,
      height: 724,
    },
    industry: "Wholesale distribution",
    timeline: "13-week rollout",
    results: [
      { value: "60%", label: "faster invoice processing" },
      { value: "68%", label: "processed without manual data re-entry" },
      { value: "675 hrs", label: "recovered each month" },
      { value: "$388,800", label: "annual finance capacity redirected" },
    ],
    body: [
      {
        kind: "paragraph",
        text: "A North American wholesale distributor of baby care, personal care, and household products relied on more than 200 domestic and international suppliers to serve retailers across Canada and the United States.",
      },
      {
        kind: "paragraph",
        text: "That supplier network supported a broad product catalogue, but every vendor introduced another invoice layout, naming convention, tax structure, and submission method. Documents arrived through email, supplier portals, and scanned uploads in both English and French.",
      },
      {
        kind: "paragraph",
        text: "Nextract transformed those variations into one standardized invoice workflow without requiring suppliers to change how they prepared or submitted their documents.",
      },
      { kind: "heading", text: "Every supplier introduced another invoice process" },
      {
        kind: "paragraph",
        text: "The wholesaler processed 4,500 supplier invoices each month. Although NetSuite served as its core financial system, much of the information entering the ERP still had to be located, interpreted, checked, and entered manually.",
      },
      {
        kind: "paragraph",
        text: "A purchase-order reference might appear at the top of one invoice, inside the notes section of another, or be missing entirely. Similar products could be identified using a supplier code, a commercial product name, or a short description that employees had to interpret.",
      },
      {
        kind: "paragraph",
        text: "English and French invoices also used different field names, tax terminology, and payment conditions. Even when two documents contained the same information, the accounts-payable team could not expect to find it in the same location or format.",
      },
      {
        kind: "paragraph",
        text: "For every invoice, an employee had to capture the supplier and invoice details, review the line items, check quantities and prices, confirm calculations, resolve missing information, and enter the approved values into NetSuite.",
      },
      {
        kind: "paragraph",
        text: "The average invoice required 15 minutes to process. Across 4,500 monthly invoices, that represented 1,125 hours of finance work every month — roughly $54,000 in staff capacity at a blended operating cost of $48 per hour, or $648,000 annually.",
      },
      {
        kind: "quote",
        text: "Adding a supplier used to mean teaching the team another invoice format. We needed the process to adapt to our vendors, not the other way around.",
        cite: "Head of Accounts Payable Transformation, North American Wholesale Distributor",
      },
      {
        kind: "image",
        src: "/images/success-stories/wholesaler-before-after.png",
        alt: "Before Nextract, invoices from email, supplier portal, and file uploads went through manual review and data entry into NetSuite; with Nextract, they are automatically extracted, validated, and standardized, with exceptions flagged for review. Processing time 15→6 min, monthly workload 1,125→450 hours, approval cycle 4→2 days.",
        width: 1672,
        height: 941,
      },
      { kind: "heading", text: "Before and after Nextract" },
      {
        kind: "paragraph",
        text: "Before Nextract, invoices arrived through several channels and required employees to interpret each supplier's document manually — locating purchase-order references, capturing product and pricing information, checking taxes and totals, and re-entering approved data into NetSuite. Processing required 15 minutes per invoice, approvals took four business days, and the workflow consumed 1,125 staff hours each month.",
      },
      {
        kind: "paragraph",
        text: "With Nextract, invoices are collected through the wholesaler's existing channels, extracted, and organized into one consistent structure. Valid invoices continue through the workflow, while documents containing missing or inconsistent information are separated for review. Processing dropped to six minutes per invoice, approvals fell to two business days, and monthly effort dropped to 450 hours.",
      },
      { kind: "heading", text: "One workflow across hundreds of supplier formats" },
      {
        kind: "paragraph",
        text: "The wholesaler did not want to force more than 200 vendors to adopt one template or move to a new submission portal. The new process needed to work with the supplier network already in place, so invoices continued arriving through email, supplier portals, and file uploads.",
      },
      {
        kind: "paragraph",
        text: "Nextract captured supplier details, invoice dates, purchase-order references, product descriptions, quantities, prices, taxes, payment terms, currencies, subtotals, and final amounts. Whether the original document was a digital PDF, a scanned file, an English invoice, or a French invoice, the extracted information followed the wholesaler's internal data structure.",
      },
      {
        kind: "paragraph",
        text: "Nextract also checked whether required fields were present and whether quantities, prices, taxes, subtotals, and totals were logically consistent. Documents with missing references, calculation issues, or unusual values were routed to the accounts-payable team instead of entering the routine processing path. Once an invoice passed the required checks, its structured data was prepared for NetSuite, with the original document kept linked to the record for review and audit.",
      },
      { kind: "heading", text: "Starting with the suppliers creating the most work" },
      {
        kind: "paragraph",
        text: "The rollout began with 30 high-volume suppliers representing 60% of monthly invoice activity. This let the implementation team test the workflow against the formats encountered most often, refine English and French field mappings, and define which exceptions required employee attention.",
      },
      {
        kind: "paragraph",
        text: "Once the team was confident in the extraction and validation process, Nextract expanded across additional suppliers and invoice types. Bringing a new vendor into the workflow no longer meant teaching employees where that supplier placed every field or redesigning the process around another invoice format.",
      },
      { kind: "heading", text: "Faster processing without expanding the AP team" },
      {
        kind: "paragraph",
        text: "Average invoice-processing time decreased from 15 minutes to six minutes, a 60% reduction. A total of 68% of routine invoices moved from intake to validated NetSuite data without manual re-entry — employees kept responsibility for approvals and exceptions, but no longer needed to capture every field from every document.",
      },
      {
        kind: "paragraph",
        text: "Approval cycles fell from four business days to two, making the process 50% faster, and the share of invoices needing data-entry or validation corrections dropped from 20% to 10%. The workflow recovered 675 staff hours every month — about $32,400 in monthly capacity, or $388,800 annually, redirected toward exception management, supplier coordination, and stronger financial controls.",
      },
      { kind: "heading", text: "Scale the supplier network without scaling manual work" },
      {
        kind: "paragraph",
        text: "By adapting to existing supplier documents instead of imposing a new template, Nextract gave the wholesaler one consistent way to receive, standardize, validate, and process invoices across languages, formats, and submission channels.",
      },
    ],
  },
  {
    type: "success-story",
    slug: "north-american-retailer-po-invoice-delivery-matching",
    title: "How a North American Retailer Automated PO, Invoice, and Delivery Matching",
    excerpt:
      "See how a North American retailer connected purchase orders, invoices, shipping records, and warehouse receipts to cut reconciliation time by 61% and identify discrepancies before supplier payment.",
    kicker: "Success story",
    image: {
      src: "/images/success-stories/retailer-impact.png",
      alt: "Case study snapshot — retail, 14-week rollout: 61% faster reconciliation, 66% of transactions auto-matched, 1,144 hours recovered each month, and $617,760 in annual capacity redirected.",
      width: 2103,
      height: 748,
    },
    industry: "Retail",
    timeline: "14-week rollout",
    results: [
      { value: "61%", label: "faster reconciliation" },
      { value: "66%", label: "of transactions auto-matched" },
      { value: "1,144 hrs", label: "recovered each month" },
      { value: "$617,760", label: "annual capacity redirected" },
    ],
    body: [
      {
        kind: "paragraph",
        text: "The purchase order showed 1,000 units. The supplier invoiced the retailer for all 1,000, and the bill of lading confirmed that the full shipment had left the supplier's facility.",
      },
      {
        kind: "paragraph",
        text: "The warehouse, however, recorded only 850 units received.",
      },
      {
        kind: "paragraph",
        text: "Before approving payment, the finance team had to determine what had happened to the remaining 150 units. Were they still in transit? Had they been damaged during delivery? Was the warehouse record incomplete? Or had the retailer been invoiced for goods that never arrived?",
      },
      {
        kind: "paragraph",
        text: "For a North American multi-category retailer processing 6,240 supplier invoices each month, this was not an isolated case. Partial shipments, damaged products, unsupported freight charges, pricing differences, and incomplete receiving records regularly created gaps between what was ordered, shipped, received, and invoiced.",
      },
      {
        kind: "paragraph",
        text: "Nextract connected those records within one document-matching workflow, helping the retailer identify the source of discrepancies before payments were released.",
      },
      { kind: "heading", text: "Every department held a different part of the transaction" },
      {
        kind: "paragraph",
        text: "The retailer operated more than 90 stores across automotive, hardware, household, and seasonal categories. Its supplier network included more than 300 manufacturers, distributors, and logistics providers serving three regional distribution centres.",
      },
      {
        kind: "paragraph",
        text: "Procurement knew what the company had ordered. Accounts payable received the supplier invoice. Transportation teams managed bills of lading and proofs of delivery, while warehouse employees recorded what had physically arrived. No single record showed the full transaction.",
      },
      {
        kind: "paragraph",
        text: "When everything matched, an invoice could move forward quickly. When it did not, employees searched the ERP, warehouse-management system, supplier portals, shared inboxes, and document attachments to reconstruct what had happened.",
      },
      {
        kind: "paragraph",
        text: "The team spent an average of 18 minutes reconciling each supplier transaction. Across 6,240 monthly invoices, that represented 1,872 hours of work every month — more than 11 full-time employees — and roughly $84,240 each month at a blended cost of $45 per hour, or more than $1 million annually.",
      },
      {
        kind: "paragraph",
        text: "The real challenge was not simply detecting that two numbers were different. It was identifying where the difference had occurred and which team needed to resolve it.",
      },
      {
        kind: "image",
        src: "/images/success-stories/retailer-before-after.png",
        alt: "Before Nextract, PO, invoice, shipping, and receiving records went through manual comparison and data entry; with Nextract, they are connected and matched, with exceptions flagged for review and validated transactions sent to payment. Matching time 18→7 min, monthly hours 1,872→728, approval cycle 4→2 days.",
        width: 1774,
        height: 887,
      },
      { kind: "heading", text: "Before and after Nextract" },
      {
        kind: "paragraph",
        text: "Before Nextract, purchase orders, invoices, shipping documents, and warehouse receipts lived across separate systems. Employees manually found each record, compared quantities and prices, investigated differences through email, and passed the transaction between departments before approving payment. Matching required 18 minutes per transaction, monthly reconciliation consumed 1,872 staff hours, and invoices remained in approval for an average of four business days.",
      },
      {
        kind: "paragraph",
        text: "With Nextract, the documents are connected through shared supplier, purchase-order, shipment, and delivery references. Matching transactions continue through the standard payment process, while discrepancies are presented with the affected values and supporting records already identified. Matching time fell to seven minutes, monthly effort decreased to 728 hours, and the approval cycle dropped to two business days.",
      },
      { kind: "heading", text: "Finding where the transaction stopped matching" },
      {
        kind: "paragraph",
        text: "Traditional three-way matching compares the purchase order, supplier invoice, and goods-received record. For this retailer, shipping documents provided the additional context needed to explain discrepancies.",
      },
      {
        kind: "paragraph",
        text: "In the 1,000-unit example, the purchase order and invoice agreed, but the warehouse receipt did not. If the bill of lading showed that only 850 units had shipped, the issue likely originated with the supplier. If it confirmed that all 1,000 units had left the supplier's facility, the retailer could investigate the carrier, delivery process, or warehouse receiving record. If the order had been intentionally divided across multiple shipments, payment could be held or adjusted according to the retailer's policy.",
      },
      {
        kind: "paragraph",
        text: "By connecting all four records, the team could identify where the transaction stopped matching rather than investigating every possible explanation from the beginning.",
      },
      { kind: "heading", text: "Connecting the complete transaction with Nextract" },
      {
        kind: "paragraph",
        text: "Nextract collected and organized documents from the retailer's existing systems, supplier portals, email attachments, and upload channels. It extracted supplier references, purchase-order numbers, shipment details, delivery locations, product codes, quantities, prices, freight charges, taxes, dates, and totals, then associated those values using shared references such as the supplier, purchase order, shipment number, and receiving location.",
      },
      {
        kind: "paragraph",
        text: "When the ordered, shipped, received, and invoiced information aligned within the retailer's tolerance rules, the transaction continued through the routine payment process. When a discrepancy appeared, Nextract highlighted the affected fields and presented the related records together, so employees could immediately see whether the issue involved quantity, pricing, freight, missing documentation, or an incomplete warehouse receipt.",
      },
      {
        kind: "paragraph",
        text: "The retailer retained control of the payment decision. Nextract made the evidence required for that decision faster to find and easier to understand.",
      },
      { kind: "heading", text: "Faster reconciliation and stronger payment control" },
      {
        kind: "paragraph",
        text: "Average matching time fell from 18 minutes to seven minutes, reducing reconciliation effort by 61%. A total of 66% of routine transactions matched within the retailer's tolerance rules and moved forward without employees manually comparing every document.",
      },
      {
        kind: "paragraph",
        text: "Invoice approval cycles decreased from four business days to two, an improvement of 50%. Missing records and conflicting values were identified earlier, so invoices spent less time moving between finance, procurement, transportation, and warehouse teams. The retailer also recorded 38% fewer discrepancies discovered after payment, reducing its exposure to missing quantities, unsupported charges, incorrect prices, and incomplete deliveries.",
      },
      {
        kind: "paragraph",
        text: "Overall, the workflow recovered 1,144 staff hours every month — about $51,480 in monthly capacity, or $617,760 annually, redirected toward higher-value finance, supplier-management, and payment-control work.",
      },
      {
        kind: "quote",
        text: "We no longer had to rebuild the transaction through emails. The mismatch and supporting documents were already connected, so the right team could act before payment.",
        cite: "Retail Finance Controller, North American Multi-Category Retailer",
      },
      { kind: "heading", text: "See the complete transaction before approving payment" },
      {
        kind: "paragraph",
        text: "Nextract helps retail and CPG teams connect purchase orders, supplier invoices, shipping records, and warehouse receipts so discrepancies can be investigated and resolved before payments are released.",
      },
    ],
  },
  {
    type: "success-story",
    slug: "north-american-manufacturer-multi-currency-invoices",
    title: "How a North American Manufacturer Standardized Multi-Currency Supplier Invoices",
    excerpt:
      "See how a North American manufacturer automated multi-currency invoice processing, reduced currency-related corrections, and improved reporting across its global supplier network.",
    kicker: "Success story",
    image: {
      src: "/images/success-stories/manufacturer-impact.png",
      alt: "Case study snapshot — manufacturing, 12-week rollout: 73% converted without manual calculations, 44% fewer currency-related corrections, 1 week removed from month-end reporting, and $259,200 in annual finance capacity redirected.",
      width: 2103,
      height: 748,
    },
    industry: "Manufacturing",
    timeline: "12-week rollout",
    results: [
      { value: "73%", label: "converted without manual calculations" },
      { value: "44%", label: "fewer currency-related corrections" },
      { value: "1 week", label: "removed from month-end reporting" },
      { value: "$259,200", label: "annual finance capacity redirected" },
    ],
    body: [
      {
        kind: "paragraph",
        text: "A North American manufacturer sourced raw materials, packaging, components, and equipment from suppliers across Canada, the United States, Germany, the United Kingdom, China, and Japan.",
      },
      {
        kind: "paragraph",
        text: "Its global supplier network supported production across several facilities, but it also created six different ways of interpreting supplier costs. Invoices arrived in Canadian dollars, U.S. dollars, euros, British pounds, Chinese yuan, and Japanese yen, using different layouts, tax structures, freight conventions, and payment terms.",
      },
      {
        kind: "paragraph",
        text: "Nextract gave the manufacturer one consistent process for identifying currencies, applying approved exchange rates, validating converted values, and preparing international invoices for SAP S/4HANA.",
      },
      { kind: "heading", text: "Global sourcing created conflicting supplier costs" },
      {
        kind: "paragraph",
        text: "The manufacturer processed 2,700 international supplier invoices every month across more than 120 cross-border and overseas vendors. The challenge was not simply that invoices arrived in different currencies — suppliers also presented financial information in different ways.",
      },
      {
        kind: "paragraph",
        text: "A German component supplier might invoice in euros and list freight separately. A Chinese supplier could use CNY for one agreement and USD for another. Some invoices displayed a clear currency code, while others used a dollar symbol that could refer to either Canadian or U.S. dollars.",
      },
      {
        kind: "paragraph",
        text: "Before approving an invoice, finance employees had to identify the currency, determine which exchange rate applied, calculate the reporting value, verify taxes and freight charges, and enter both the original and converted amounts into SAP S/4HANA.",
      },
      {
        kind: "paragraph",
        text: "Differences between the invoice date, approval date, and payment date also created uncertainty about which rate should be used. As a result, the same supplier cost could appear differently across accounts payable, procurement, and financial reporting. Currency-related corrections affected 16% of international invoices, and teams frequently had to revisit ambiguous currency symbols, outdated exchange rates, and incorrectly entered reporting values.",
      },
      {
        kind: "quote",
        text: "The invoice could be accurate, but the value in our reporting system could still be wrong if the currency or exchange rate was interpreted differently.",
        cite: "Global Accounts Payable Lead, North American Manufacturer",
      },
      {
        kind: "image",
        src: "/images/success-stories/manufacturer-before-after.png",
        alt: "Before Nextract, multi-currency supplier invoices went through manual currency identification, exchange-rate lookup, conversion, and data entry; with Nextract, the currency is captured and the amount converted and validated, with exceptions routed for review. Processing 17→7 min, monthly hours 765→315, month-end reporting 5→2 days, operating cost $36,720→$15,120.",
        width: 1774,
        height: 887,
      },
      { kind: "heading", text: "Before and after Nextract" },
      {
        kind: "paragraph",
        text: "Before Nextract, finance employees manually identified currencies, searched for exchange rates, converted invoice values, reviewed taxes and freight charges, and entered the results into the company's financial system. Each invoice required 17 minutes to prepare, the workflow consumed 765 finance hours per month, and international supplier reporting took about five business days to reconcile at month-end — roughly $36,720 each month at a blended $48 per hour, or $440,640 annually.",
      },
      {
        kind: "paragraph",
        text: "With Nextract, the invoice currency is captured and the original value retained, the manufacturer's approved conversion rules are applied, the converted amount is validated, and unclear or inconsistent documents are routed for review. Processing fell to seven minutes per invoice, monthly effort decreased to 315 hours, and international supplier reporting was completed in about two business days.",
      },
      { kind: "heading", text: "Creating one multi-currency invoice workflow" },
      {
        kind: "paragraph",
        text: "The manufacturer introduced Nextract without changing how suppliers submitted their documents. Invoices continued arriving through email, supplier portals, and file uploads. Nextract captured supplier information, invoice dates, currency codes, line items, freight charges, taxes, subtotals, and final amounts, then organized the information into a consistent structure.",
      },
      {
        kind: "paragraph",
        text: "When the invoice currency differed from the company's corporate reporting currency, the workflow applied the approved exchange rate while retaining both the original amount and its converted value. This let procurement teams understand the invoice in its original commercial context while giving finance a consistent value for approval, accounting, and reporting.",
      },
      {
        kind: "paragraph",
        text: "Invoices with missing currency codes, ambiguous symbols, unusual conversion differences, unsupported charges, or totals that did not reconcile were held for review. Routine invoices could continue without employees repeating the same currency calculations manually.",
      },
      { kind: "heading", text: "More reliable reporting across six currencies" },
      {
        kind: "paragraph",
        text: "A total of 73% of routine international invoices were converted, validated, and prepared for SAP S/4HANA without manual currency calculations. Currency-related corrections fell from 16% of international invoices to 9% — a 44% reduction — with the largest improvements involving ambiguous dollar symbols, outdated rates, inconsistent conversions, and incorrectly entered reporting values.",
      },
      {
        kind: "paragraph",
        text: "Month-end reconciliation for international supplier costs decreased from five business days to two, removing three days from the reporting process. Average invoice-processing time also fell from 17 minutes to seven minutes, a 59% reduction, recovering 450 finance hours each month — about $21,600 per month, or $259,200 annually, redirected toward supplier analysis, financial controls, and higher-risk invoice reviews.",
      },
      { kind: "heading", text: "One consistent view of international supplier costs" },
      {
        kind: "paragraph",
        text: "Standardizing multi-currency invoice data gave finance and procurement teams a more reliable basis for comparing global suppliers. They could distinguish more clearly between supplier price increases, freight changes, tax differences, and currency movements — working from consistent converted values while still retaining access to the original CAD, USD, EUR, GBP, CNY, and JPY amounts.",
      },
      { kind: "heading", text: "Standardize international invoices across your supplier network" },
      {
        kind: "paragraph",
        text: "Nextract helps manufacturers convert, validate, and report supplier invoices across currencies without losing their original financial context.",
      },
    ],
  },
  {
    type: "success-story",
    slug: "north-american-construction-vendor-intelligence-hub",
    title: "How a North American Construction Company Built a Centralized Vendor Intelligence Hub",
    excerpt:
      "See how a North American construction company connected invoices, purchase orders, subcontracts, deliveries, pricing, and exceptions to cut vendor research time by 78%.",
    kicker: "Success story",
    image: {
      src: "/images/success-stories/construction-impact.png",
      alt: "Case study snapshot — construction, 11-week rollout: 78% faster vendor research, 72% of routine questions answered without manual searches, 545 hours recovered each month, and $320K in annual operating capacity redirected.",
      width: 2103,
      height: 748,
    },
    industry: "Construction",
    timeline: "11-week rollout",
    results: [
      { value: "78%", label: "faster vendor research" },
      { value: "72%", label: "of routine questions answered without manual searches" },
      { value: "545 hrs", label: "recovered each month" },
      { value: "$320K", label: "annual operating capacity redirected" },
    ],
    body: [
      {
        kind: "paragraph",
        text: "A North American construction company managed dozens of active projects supported by hundreds of material suppliers, equipment providers, and subcontractors.",
      },
      {
        kind: "paragraph",
        text: "The company generated large amounts of vendor data every day. Purchase orders showed what had been committed. Invoices recorded what vendors charged. Delivery tickets confirmed what reached the jobsite. Subcontracts, change orders, pricing records, payment history, and billing exceptions added more information about each relationship.",
      },
      {
        kind: "paragraph",
        text: "The answers existed, but they were scattered across NetSuite, Procore, spreadsheets, shared inboxes, project folders, and supporting documents.",
      },
      {
        kind: "paragraph",
        text: "Nextract brought those records together and added an AI intelligence layer that let finance, procurement, and project teams ask questions about a vendor and receive an answer grounded in the company's existing data.",
      },
      { kind: "heading", text: "Plenty of vendor data, but no complete vendor view" },
      {
        kind: "paragraph",
        text: "The construction company worked with 275 suppliers and subcontractors across 68 active commercial, industrial, and renovation projects. Finance teams could see invoices and payments. Procurement managed purchase orders, subcontracts, and pricing agreements. Project teams tracked deliveries, change orders, job costs, and work completed. Supporting documents and conversations often remained inside email threads or separate project folders.",
      },
      {
        kind: "paragraph",
        text: "Whenever an employee needed a full view of a vendor, the research began again. A project manager investigating a material shortage might ask finance for the supplier's invoice history, contact procurement for the original purchase order, and search Procore for delivery records. Before a subcontractor review, commercial teams manually gathered contract values, approved changes, billing exceptions, payment history, and project performance.",
      },
      {
        kind: "paragraph",
        text: "The company handled approximately 860 vendor-information requests each month. Gathering a complete answer took an average of 49 minutes, consuming more than 702 staff hours every month — about $34,400 each month, or more than $413,000 in annual staff capacity, at the company's blended operating cost. The problem was not a shortage of information; it was the time required to assemble enough context to make a confident decision.",
      },
      {
        kind: "image",
        src: "/images/success-stories/construction-before-after.png",
        alt: "Before Nextract, vendor information was scattered across NetSuite, Procore, spreadsheets, shared inboxes, and project folders, requiring manual research across multiple systems; with Nextract, those sources connect around one vendor record and an AI agent answers supplier questions, links to supporting records, and identifies patterns. Average research time 49→11 min, monthly research hours 702→158.",
        width: 1774,
        height: 887,
      },
      { kind: "heading", text: "Before and after Nextract" },
      {
        kind: "paragraph",
        text: "Before Nextract, vendor information was separated across NetSuite, Procore, spreadsheets, shared inboxes, and project folders. Employees manually gathered invoices, purchase orders, subcontracts, deliveries, pricing, payment records, and exceptions before they could answer a supplier question. A complete vendor response took 49 minutes, and monthly research consumed more than 702 staff hours.",
      },
      {
        kind: "paragraph",
        text: "With Nextract, vendor documents and transaction history are connected around one supplier record. An AI agent can then retrieve the relevant information, identify patterns, summarize findings, and link the answer back to its supporting records. Average research time fell to 11 minutes, while monthly effort decreased to approximately 158 hours.",
      },
      { kind: "heading", text: "Creating one history for every vendor" },
      {
        kind: "paragraph",
        text: "Nextract structured incoming supplier and subcontractor invoices and associated them with the relevant vendor, project, purchase order, line items, pricing information, original documents, and payment history. Information from connected procurement and project systems — including delivery records, subcontracts, change orders, and documented exceptions — was linked to the same vendor history.",
      },
      {
        kind: "paragraph",
        text: "Instead of viewing each invoice or delivery as an isolated event, teams could see the wider relationship: what the company had committed, what it purchased, what was delivered, what was invoiced, what had been paid, and which issues appeared repeatedly. This gave finance, procurement, and project teams a shared foundation rather than separate versions of the same vendor relationship.",
      },
      { kind: "heading", text: "Asking questions instead of building reports" },
      {
        kind: "paragraph",
        text: "Centralizing vendor information solved only part of the problem — employees still needed an efficient way to use it. The company introduced an AI agent that could retrieve and analyze information across each vendor's history, letting teams ask questions in plain language.",
      },
      {
        kind: "quote",
        text: "Summarize our work with this subcontractor over the last 12 months, including committed value, approved change orders, invoice exceptions, payment history, and issues across active projects.",
      },
      {
        kind: "paragraph",
        text: "The agent could gather the relevant information and return a concise summary connected to the underlying records. Procurement could ask whether material prices were increasing. Finance could identify invoices that repeatedly failed validation. Project teams could review late or incomplete deliveries. Commercial leaders could compare subcontractors working across similar projects. The agent did not make the final sourcing, payment, or contract decision; it reduced the time required to gather the evidence behind that decision.",
      },
      { kind: "heading", text: "Faster research and earlier identification of vendor issues" },
      {
        kind: "paragraph",
        text: "Average vendor-information retrieval time fell from 49 minutes to 11 minutes, a 78% reduction. Approximately 72% of routine vendor questions could be answered without employees manually searching across multiple systems. More complex requests still involved finance, procurement, or project teams, but they began with the relevant records already assembled.",
      },
      {
        kind: "paragraph",
        text: "The workflow recovered approximately 545 staff hours each month — more than $320,000 in annual capacity redirected toward project controls, contract management, supplier negotiations, and higher-risk financial reviews. Recurring vendor issues were also resolved 35% sooner, as quantity discrepancies, unsupported charges, repeated late deliveries, and change-order billing differences became visible across the vendor's history instead of remaining hidden inside individual transactions.",
      },
      {
        kind: "quote",
        text: "We stopped treating every supplier issue as a separate event. We could see the full relationship, understand whether the problem was recurring, and make decisions using the same information across every team.",
        cite: "Director of Commercial Operations, North American Construction Company",
      },
      { kind: "heading", text: "Better vendor decisions across every project" },
      {
        kind: "paragraph",
        text: "The vendor intelligence hub gave teams a stronger basis for evaluating suppliers and subcontractors. Procurement could compare vendors using pricing history, delivery performance, and invoice accuracy — not quoted cost alone. Finance could review payment and exception patterns before approving changes. Project leaders could identify vendors connected to repeated delays, shortages, or billing disputes across multiple jobs.",
      },
      {
        kind: "paragraph",
        text: "Contract negotiations also became more evidence-based. Instead of relying on isolated examples or employee memory, commercial teams could review committed spend, approved changes, pricing movements, payment history, and recurring exceptions together. What began as an effort to organize vendor records became a decision-support capability across the company's project portfolio.",
      },
      { kind: "heading", text: "Turn construction vendor records into usable intelligence" },
      {
        kind: "paragraph",
        text: "Nextract helps construction companies connect supplier invoices, purchase orders, subcontracts, deliveries, pricing, payment history, and exceptions so teams can find answers faster and make better-informed vendor decisions.",
      },
    ],
  },

  // ---------- Events ----------
  {
    type: "event",
    slug: "nextract-at-accountex-canada-2026",
    title: "Nextract is Coming to Accountex Canada 2026",
    excerpt:
      "We're exhibiting at Accountex Canada 2026 — bringing AI-powered document processing to one of Canada's leading events for accounting and finance professionals.",
    kicker: "Trade show",
    image: {
      src: "/images/events/accountex-canada-2026.png",
      alt: "Nextract is coming to Accountex Canada 2026 — November 3–4, 2026, Toronto, Canada.",
      width: 1672,
      height: 941,
    },
    format: "In-person exhibition",
    date: "3–4 Nov 2026",
    time: "Exhibition hours",
    location: "The International Centre, Mississauga, Ontario",
    duration: "Two-day event",
    speakers: [{ name: "The Nextract Team", role: "Product & Solutions" }],
    body: [
      {
        kind: "paragraph",
        text: "We're excited to announce that Nextract will be exhibiting at Accountex Canada 2026, bringing AI-powered document processing to one of Canada's events for accounting and finance professionals.",
      },
      {
        kind: "paragraph",
        text: "Every day, finance and accounting teams spend valuable time extracting information, checking invoices, matching purchase orders, and resolving discrepancies. But what if AI could handle much of that repetitive work while keeping people in control? That's exactly what we're bringing to Accountex.",
      },
      { kind: "heading", text: "Discover a smarter way to process documents" },
      {
        kind: "paragraph",
        text: "Nextract helps businesses turn complex documents into structured, validated, and actionable information. From invoice processing to document matching and exception handling, our platform simplifies workflows that traditionally require hours of manual effort.",
      },
      {
        kind: "paragraph",
        text: "At Accountex, we'll be highlighting four key capabilities:",
      },
      { kind: "heading", text: "Intelligent document extraction" },
      {
        kind: "paragraph",
        text: "Turn invoices, purchase orders, and goods receipt notes into structured data automatically. Nextract supports English and French, multi-page and handwritten documents, and captures important information down to individual line items.",
      },
      { kind: "heading", text: "Two-way and three-way matching" },
      {
        kind: "paragraph",
        text: "Go beyond extracting information. Nextract compares invoices, purchase orders, and goods receipts to detect discrepancies in quantities, pricing, and deliveries. It also helps track partial invoices and remaining balances across related documents.",
      },
      { kind: "heading", text: "Human-in-the-loop review" },
      {
        kind: "paragraph",
        text: "Automation shouldn't mean losing control. Nextract makes it easy to review extracted information, correct uncertain values, manage exceptions, and approve data before publishing it to connected systems.",
      },
      { kind: "heading", text: "AI-powered AP assistant" },
      {
        kind: "paragraph",
        text: "Find answers without searching through countless documents. Ask questions about invoice statuses, matching results, or pending exceptions, and use AI to retrieve insights and generate document activity reports.",
      },
      { kind: "heading", text: "Built for real-world financial workflows" },
      {
        kind: "paragraph",
        text: "Not every document follows the same process. That's why Nextract also supports service invoice automation, comparing billing information against purchase orders and statements of work, as well as freight and logistics document processing, extracting shipment details, transportation costs, and additional charges.",
      },
      {
        kind: "paragraph",
        text: "With configured integrations for Salesforce and Sage, reviewed document information can flow into existing business systems, reducing duplicate data entry and helping teams maintain control over their processes.",
      },
      { kind: "heading", text: "Let's connect at Accountex Canada 2026" },
      {
        kind: "paragraph",
        text: "Whether you're looking to reduce manual invoice processing, improve document accuracy, or explore how AI fits into your existing workflows, we'd love to meet you.",
      },
      {
        kind: "paragraph",
        text: "Join us at Accountex Canada 2026, taking place November 3–4 at The International Centre in Mississauga, Ontario. Let's explore how your documents can do more for your business.",
      },
    ],
  },
];

export const getPost = (type: Post["type"], slug: string) =>
  posts.find((p) => p.type === type && p.slug === slug);

export const getPostsByType = <T extends Post["type"]>(type: T) =>
  posts.filter((p): p is Extract<Post, { type: T }> => p.type === type);
