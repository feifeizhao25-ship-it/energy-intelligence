'use client';

/**
 * MarkdownRenderer — renders assistant markdown to sanitized HTML.
 * marked parses; DOMPurify strips scripts and unsafe attributes.
 */

import React, { useMemo } from 'react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

export interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className }) => {
  const html = useMemo(() => {
    let text = content;
    try {
      const rendered = marked.parse(text, { async: false });
      return DOMPurify.sanitize(rendered, {
        ALLOWED_TAGS: [
          'p', 'br', 'strong', 'em', 'code', 'pre', 'blockquote',
          'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'a', 'table',
          'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'span',
        ],
        ALLOWED_ATTR: ['href', 'title', 'target', 'rel', 'class'],
      });
    } catch {
      // Fall back to escaped plain text when parsing fails.
      const escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      return `<p>${escaped}</p>`;
    }
  }, [content]);

  return (
    <div
      className={className}
      // Sanitized above via DOMPurify with a strict allowlist.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default MarkdownRenderer;
