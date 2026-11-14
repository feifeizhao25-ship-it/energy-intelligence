'use client';

import { Loader2, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { assistantSubmitControl, pressAssistantComposer } from '@/lib/assistant/live-turn';

export function AssistantComposerButton({
  loading,
  draft,
  onStop,
  onSend,
}: {
  loading: boolean;
  draft: string;
  onStop: () => void;
  onSend: () => void;
}) {
  const control = assistantSubmitControl(loading, draft);
  return (
    <button
      type="button"
      data-testid={loading ? 'stop-assistant' : 'send-assistant'}
      onClick={() => pressAssistantComposer({ loading, stop: onStop, send: onSend })}
      disabled={control.disabled}
      className={cn(
        'px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium transition-all',
        draft.trim() || loading
          ? 'bg-primary hover:bg-primary-600 text-white shadow-lg shadow-primary/20'
          : 'bg-surface-dark text-text-secondary cursor-not-allowed',
      )}
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          {control.label}
        </>
      ) : (
        <>
          {control.label}
          <Send className="w-4 h-4" />
        </>
      )}
    </button>
  );
}
