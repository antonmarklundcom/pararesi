"use client";

import { useState } from "react";
import { marked } from "marked";

// Client-side approximate preview only (no sanitization) — for the admin's
// own convenience while writing. The real render (src/lib/markdown.ts) always
// sanitizes server-side before any member ever sees this content.
export function MarkdownTextarea({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue?: string;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between">
        <label htmlFor={name} className="block text-sm font-medium text-brand-navy-900">
          {label}
        </label>
        <button
          type="button"
          onClick={() => setShowPreview((v) => !v)}
          className="text-xs font-medium text-brand-green-600 hover:text-brand-green-700"
        >
          {showPreview ? "Edit" : "Preview"}
        </button>
      </div>
      {showPreview ? (
        <div
          className="prose prose-sm mt-1 min-h-[240px] w-full rounded-lg border border-brand-navy-900/20 px-3 py-2 text-sm"
          dangerouslySetInnerHTML={{ __html: marked.parse(value, { async: false }) }}
        />
      ) : (
        <textarea
          id={name}
          name={name}
          rows={12}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mt-1 w-full rounded-lg border border-brand-navy-900/20 px-3 py-2 font-mono text-sm focus:border-brand-green-600 focus:outline-none"
        />
      )}
    </div>
  );
}
