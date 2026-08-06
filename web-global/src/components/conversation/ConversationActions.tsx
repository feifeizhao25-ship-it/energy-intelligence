'use client';

/**
 * ConversationActions — bookmark / copy / export actions for one assistant
 * answer. Bookmark state is persisted locally so it survives reloads.
 */

import React, { useEffect, useState } from 'react';

export interface ConversationActionsProps {
  messageId: string;
  content: string;
}

const STORAGE_KEY = 'energyiq.bookmarks';

function readBookmarks(): string[] {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

export const ConversationActions: React.FC<ConversationActionsProps> = ({ messageId, content }) => {
  const [bookmarked, setBookmarked] = useState(false);
  const [copied, setCopied] = useState(false);

  // Load the persisted bookmark status.
  useEffect(() => {
    setBookmarked(readBookmarks().includes(messageId));
  }, [messageId]);

  function toggleBookmark() {
    const bookmarks = readBookmarks();
    const next = bookmarks.includes(messageId)
      ? bookmarks.filter((id) => id !== messageId)
      : [...bookmarks, messageId];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setBookmarked(next.includes(messageId));
  }

  async function copyContent() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  function exportMarkdown() {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `answer-${messageId}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex items-center gap-1 text-[12px]">
      <button
        type="button"
        onClick={toggleBookmark}
        aria-pressed={bookmarked}
        className="rounded px-2 py-1 text-[var(--text-tertiary)] hover:bg-[var(--bg-secondary)]"
      >
        {bookmarked ? '★ Bookmarked' : '☆ Bookmark'}
      </button>
      <button
        type="button"
        onClick={() => void copyContent()}
        className="rounded px-2 py-1 text-[var(--text-tertiary)] hover:bg-[var(--bg-secondary)]"
      >
        {copied ? '✓ Copied' : 'Copy'}
      </button>
      <button
        type="button"
        onClick={exportMarkdown}
        className="rounded px-2 py-1 text-[var(--text-tertiary)] hover:bg-[var(--bg-secondary)]"
      >
        Export
      </button>
    </div>
  );
};

export default ConversationActions;
