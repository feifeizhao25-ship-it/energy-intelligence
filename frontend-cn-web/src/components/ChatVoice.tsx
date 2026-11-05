import { useEffect, useRef, useState } from 'react';
import { browserPlayback, speakableText } from '../lib/voice/playback';

type Rec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  processLocally?: boolean;
  onresult: (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onerror: (event: { error?: string }) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
};

function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v4" />
    </svg>
  );
}

function SpeakerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 10v4h3l5 4V6L7 10H4zM16 9a4 4 0 0 1 0 6" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

/** Narrow-page composer mic. Sits in the footer row, same height as the field. */
export function ChatMic({
  disabled,
  onTranscript,
}: {
  disabled?: boolean;
  onTranscript: (text: string) => void;
}) {
  const [listening, setListening] = useState(false);
  const [hint, setHint] = useState('语音输入');
  const recRef = useRef<Rec | null>(null);
  const localAttempt = useRef(true);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  useEffect(() => {
    const w = window as Window & { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) {
      setHint('当前浏览器不支持语音输入');
      return;
    }
    const recognition = new Ctor();
    recognition.lang = 'zh-CN';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      onTranscriptRef.current(event.results[0][0].transcript);
      setListening(false);
      setHint('语音输入');
    };
    recognition.onerror = (event) => {
      const code = event.error || '';
      if ((code === 'network' || code === 'service-not-allowed') && localAttempt.current) {
        localAttempt.current = false;
        try {
          recognition.processLocally = false;
          recognition.start();
          return;
        } catch {
          /* show the hint below */
        }
      }
      setHint(code === 'not-allowed' ? '需要麦克风权限才能语音输入' : '无法识别语音');
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recRef.current = recognition;
  }, []);

  const toggle = () => {
    const recognition = recRef.current;
    if (!recognition || disabled || hint === '当前浏览器不支持语音输入') return;
    if (listening) {
      recognition.stop();
      setListening(false);
      setHint('语音输入');
      return;
    }
    localAttempt.current = true;
    try {
      if ('processLocally' in recognition) recognition.processLocally = true;
      recognition.start();
      setListening(true);
      setHint('停止语音');
    } catch {
      setHint('无法开始语音输入');
    }
  };

  return (
    <button
      type="button"
      data-testid="voice-mic"
      onClick={toggle}
      disabled={disabled || hint === '当前浏览器不支持语音输入'}
      aria-label={listening ? '停止语音' : hint}
      title={listening ? '停止语音' : hint}
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-default)] text-[var(--text-secondary)] disabled:opacity-40"
    >
      {listening ? <StopIcon /> : <MicIcon />}
    </button>
  );
}

/** Speaker under an answer on the narrow chat page. */
export function ChatSpeaker({ id, text }: { id: string; text: string }) {
  const spoken = speakableText(text);
  const [playing, setPlaying] = useState(false);
  useEffect(() => browserPlayback.subscribe(() => setPlaying(browserPlayback.speakingId === id)), [id]);
  if (!spoken) return null;
  const label = playing ? '停止朗读' : '朗读';
  return (
    <button
      type="button"
      data-testid="voice-speak"
      aria-label={label}
      title={label}
      onClick={() => browserPlayback.toggle(id, text, 'zh-CN')}
      className="mt-2 inline-flex items-center gap-1 text-[12px] text-[var(--text-tertiary)]"
    >
      {playing ? <StopIcon /> : <SpeakerIcon />}
      <span>{label}</span>
    </button>
  );
}
