"use client";

import type { ConsentCategory, ConsentChoices } from "@workspace/cms-content";
import type { CmsSnippet } from "@/lib/cms";
import { RawScripts } from "@/components/ui/RawScripts";
import { Snippets } from "@/components/ui/Snippets";

const allCategoriesEnabled: ConsentChoices = {
  essential: true,
  functional: true,
  analytics: true,
  marketing: true,
};

/** Loads configured site scripts directly now that cookie-consent UI is disabled. */
export function RuntimeScripts({ gaId, gtmId, headerScripts, footerScripts, headerCategory, footerCategory, snippets }: {
  gaId: string;
  gtmId: string;
  headerScripts: string;
  footerScripts: string;
  headerCategory: ConsentCategory;
  footerCategory: ConsentCategory;
  snippets: CmsSnippet[];
}) {
  return (
    <>
      {gaId ? <RawScripts html={`<script async src="https://www.googletagmanager.com/gtag/js?id=${gaId}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${gaId}');</script>`} /> : null}
      {gtmId ? <RawScripts html={`<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');</script>`} /> : null}
      {allCategoriesEnabled[headerCategory] ? <RawScripts html={headerScripts} /> : null}
      <Snippets items={snippets} choices={allCategoriesEnabled} />
      {allCategoriesEnabled[footerCategory] ? <RawScripts html={footerScripts} /> : null}
    </>
  );
}
