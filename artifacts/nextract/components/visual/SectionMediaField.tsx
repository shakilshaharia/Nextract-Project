"use client";
import { sectionMedia, type SectionMediaValue } from "../ui/SectionMedia";
import { ImageReference, MediaField } from "./MediaField";

export function SectionMediaField({ value, onChange }: { value?: SectionMediaValue; onChange: (v: SectionMediaValue) => void }) {
  const v = { ...sectionMedia, ...value };
  return <div className="visual-field">
    <label>Section visual<select value={v.mode} onChange={e => onChange({ ...v, mode: e.target.value })}>
      <option value="original">Original design</option><option value="image">Image</option><option value="video">Video</option>
    </select></label>
    {v.mode === "original" && <small>Keep the original animation or visual, or choose Image or Video to replace it.</small>}
    {v.mode === "image" && <ImageReference value={v.image} onChange={image => onChange({ ...v, image: image as SectionMediaValue["image"] })} />}
    {v.mode === "video" && <><MediaField kind="video" value={v.video} onChange={video => onChange({ ...v, video })} /><label>Video description<input value={v.description} onChange={e => onChange({ ...v, description: e.target.value })} /></label></>}
  </div>;
}
