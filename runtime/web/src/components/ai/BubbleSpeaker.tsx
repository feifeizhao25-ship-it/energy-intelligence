'use client';

import { useEffect, useState } from 'react';
import { Square, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { browserPlayback, speakableText } from '@/lib/voice/playback';

/** Small speaker for a desktop answer action row. Tap plays, tap stops. 失败时按钮旁显示一行文字（音2）。 */
export function BubbleSpeaker({
  id,
  text,
  lang = 'zh-CN',
  className,
}: {
  id: string;
  text: string;
  lang?: string;
  className?: string;
}) {
  const spoken = speakableText(text);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return browserPlayback.subscribe(() => {
      setPlaying(browserPlayback.speakingId === id);
      setError(browserPlayback.lastError?.id === id ? browserPlayback.lastError.message : null);
    });
  }, [id]);

  if (!spoken) return null;
  const label = playing ? '停止朗读' : '朗读';
  return (
    <span className="inline-flex items-center gap-2">
    <button
      type="button"
      data-testid="voice-speak"
      aria-label={label}
      title={label}
      onClick={() => browserPlayback.toggle(id, text, lang)}
      className={cn(
        'inline-flex items-center justify-center p-2 rounded-lg border transition-colors',
        className ?? 'bg-surface-dark border-border-dark text-text-secondary hover:border-primary/50',
      )}
    >
      {playing ? <Square className="w-4 h-4" aria-hidden /> : <Volume2 className="w-4 h-4" aria-hidden />}
    </button>
    {error && (
      <span role="status" data-testid="voice-speak-error" className="text-xs text-amber-500">
        {error}
      </span>
    )}
    </span>
  );
}
