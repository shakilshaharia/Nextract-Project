"use client";

import type { ConsentChoices } from "@workspace/cms-content";
import type { CmsSnippet } from "@/lib/cms";
import { RawScripts } from "./RawScripts";

/**
 * Runs admin-managed snippets only when their assigned consent category is on.
 * RawScripts recreates script tags inserted after the visitor makes a choice.
 */
export function Snippets({ items, choices }: { items: CmsSnippet[]; choices: ConsentChoices }) {
  if (items.length === 0) return null;
  return (
    <>
      {items.filter((snippet) => choices[snippet.consentCategory]).map((snippet, index) => (
        <RawScripts key={`${snippet.location}-${index}`} html={snippet.language === "css" ? `<style>${snippet.code}</style>` : snippet.language === "js" ? `<script>${snippet.code}</script>` : snippet.code} />
      ))}
    </>
  );
}
