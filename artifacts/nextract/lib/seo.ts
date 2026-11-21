export const siteUrl = "https://nextract.ca";

export const seo = {
  title: "Nextract | AI Document Processing & Intelligent Document Automation",
  description:
    "Nextract turns business documents from multiple sources into structured, validated data, automates matching and exception detection, and helps teams reduce manual document work.",
  category: "AI Document Processing Platform",
  primaryKeyword: "intelligent document processing",
  secondaryKeywords: [
    "AI document processing",
    "intelligent document automation",
    "document data extraction",
    "AI document extraction",
    "invoice processing automation",
    "accounts payable automation",
    "invoice PO matching",
    "purchase order automation",
    "GRN processing",
    "document workflow automation",
    "document validation software",
    "exception management automation",
    "AI invoice processing",
  ],
  platformDescription:
    "Nextract is an intelligent document processing platform that captures business documents from multiple sources, extracts and validates the information inside them, compares related records, and surfaces exceptions that need review.",
  accountsPayableDescription:
    "Nextract helps accounts payable teams automate invoice processing, extract invoice data, match invoices against purchase orders, and identify discrepancies before approval.",
  procurementDescription:
    "Nextract helps procurement teams validate supplier documents, compare purchasing records, and detect differences in quantities, prices, vendors, and totals earlier in the process",
} as const;

export const seoKeywords = [seo.primaryKeyword, ...seo.secondaryKeywords];

export const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "Nextract",
      url: siteUrl,
      description: seo.platformDescription,
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      name: "Nextract",
      url: siteUrl,
      description: seo.description,
      inLanguage: "en",
      publisher: { "@id": `${siteUrl}/#organization` },
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${siteUrl}/#software`,
      name: "Nextract",
      url: siteUrl,
      applicationCategory: seo.category,
      operatingSystem: "Web",
      description: seo.platformDescription,
      keywords: seoKeywords.join(", "),
      featureList: [seo.accountsPayableDescription, seo.procurementDescription],
      provider: { "@id": `${siteUrl}/#organization` },
    },
  ],
};
