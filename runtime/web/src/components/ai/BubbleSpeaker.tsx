'use client';

import { useEffect, useState } from 'react';
import { Square, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { browserPlayback, speakableText } from '@/lib/voice/playback';

/** Small speaker for a desktop answer action row. Tap plays, tap stops. */
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

  useEffect(() => {
    return browserPlayback.subscribe(() => {
      setPlaying(browserPlayback.speakingId === id);
    });
  }, [id]);

  if (!spoken) return null;
  const label = playing ? '停止朗读' : '朗读';
  return (
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
  );
}
