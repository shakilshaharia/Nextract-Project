"use client";

import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import CodeMirror from "@uiw/react-codemirror";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Stable identity: @uiw/react-codemirror reconfigures the whole editor whenever
// basicSetup / extensions / onChange change, so none of them may be rebuilt on
// every render.
const basicSetup = {
  lineNumbers: true,
  foldGutter: true,
  autocompletion: true,
  bracketMatching: true,
  closeBrackets: true,
  highlightActiveLine: true,
  highlightActiveLineGutter: true,
};

/**
 * A syntax-highlighting code editor used for the HTML widget's "HTML code" and
 * "Custom CSS" fields in the visual builder. Loaded client-only (see config.tsx)
 * so CodeMirror never runs during SSR.
 *
 * The editor owns its document while it has focus. Each keystroke is sent to
 * Puck, and Puck echoes the value back a moment later; applying a stale echo
 * would replace the document and throw the caret somewhere else mid-word.
 * Values we emitted ourselves are therefore ignored while typing — only genuine
 * outside changes (undo, restore, another block) replace the contents.
 */
export function CodeField({
  value,
  onChange,
  language,
  placeholder,
}: {
  value?: string;
  onChange: (value: string) => void;
  language: "html" | "css";
  placeholder?: string;
}) {
  const [doc, setDoc] = useState(value ?? "");
  const docRef = useRef(value ?? "");
  const recent = useRef<string[]>([]);
  const focused = useRef(false);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const incoming = value ?? "";
    if (incoming === docRef.current) return;
    if (focused.current && recent.current.includes(incoming)) return;
    docRef.current = incoming;
    recent.current = [];
    setDoc(incoming);
  }, [value]);

  const extensions = useMemo(() => [language === "html" ? html() : css()], [language]);

  const handleChange = useCallback((next: string) => {
    docRef.current = next;
    recent.current = [...recent.current.slice(-49), next];
    setDoc(next);
    onChangeRef.current(next);
  }, []);

  return (
    <div
      style={{ border: "1px solid #e4e4e7", borderRadius: 10, overflow: "hidden", fontSize: 13 }}
      onFocus={() => {
        focused.current = true;
      }}
      onBlur={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        focused.current = false;
        recent.current = [];
      }}
    >
      <CodeMirror
        value={doc}
        height="260px"
        placeholder={placeholder}
        extensions={extensions}
        onChange={handleChange}
        basicSetup={basicSetup}
      />
    </div>
  );
}
