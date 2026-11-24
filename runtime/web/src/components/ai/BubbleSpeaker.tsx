'use client';

import { useRef, useState } from 'react';
import { Square, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { speakableText } from '@/lib/voice/playback';

/** Speaker plays a real WAV from /api/v1/fal/tts. The audio element stays on the page. */
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
  void lang;
  const spoken = speakableText(text);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [src, setSrc] = useState('');

  if (!spoken) return null;
  const label = playing ? '停止朗读' : '朗读';

  async function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    setError(null);
    try {
      const response = await fetch('/api/v1/fal/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: spoken }),
      });
      const body = await response.json();
      const encoded = body.audio_base64 || body.data?.audio_base64;
      if (!response.ok || typeof encoded !== 'string' || !encoded) {
        setError(body.error?.message || '朗读没有返回可播放的音频');
        return;
      }
      const source = `data:audio/wav;base64,${encoded}`;
      setSrc(source);
      audio.src = source;
      try {
        await audio.play();
        setPlaying(true);
      } catch {
        setPlaying(false);
      }
    } catch {
      setError('朗读没有返回可播放的音频');
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
    <button
      type="button"
      data-testid="voice-speak"
      aria-label={label}
      title={label}
      onClick={() => void toggle()}
      className={cn(
        'inline-flex items-center justify-center p-2 rounded-lg border transition-colors',
        className ?? 'bg-surface-dark border-border-dark text-text-secondary hover:border-primary/50',
      )}
    >
      {playing ? <Square className="w-4 h-4" aria-hidden /> : <Volume2 className="w-4 h-4" aria-hidden />}
    </button>
    <audio
      ref={audioRef}
      data-testid={`voice-audio-${id}`}
      controls
      src={src || undefined}
      onEnded={() => setPlaying(false)}
      className="h-8 max-w-[180px]"
    />
    {error && (
      <span role="status" data-testid="voice-speak-error" className="text-xs text-amber-500">
        {error}
      </span>
    )}
    </span>
  );
}
