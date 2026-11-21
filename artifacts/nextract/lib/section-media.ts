// Default media configuration shared by the section components and the content
// defaults. Kept React-free (no .tsx, no component imports) so the CMS seed —
// which reuses the site's content files — can import it without pulling in
// component code or the `@/` path alias.
export const sectionMedia = {
  mode: "original",
  image: { src: "", alt: "" },
  video: "",
  description: "",
};

export type SectionMediaValue = typeof sectionMedia;
