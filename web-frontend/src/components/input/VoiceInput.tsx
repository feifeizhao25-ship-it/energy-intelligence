'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  /** fab: guided flows. toolbar: icon inside an existing composer. */
  appearance?: 'fab' | 'toolbar';
  disabled?: boolean;
  className?: string;
}

type Rec = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  processLocally?: boolean;
  onresult: (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onerror: (event: { error?: string }) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
};

/**
 * Browser speech recognition for Chinese chat composers.
 * Prefers on-device recognition when the browser exposes `processLocally`.
 * No app speech key is stored or sent.
 */
export function VoiceInput({ onTranscript, appearance = 'fab', disabled = false, className }: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<Rec | null>(null);
  const localAttempt = useRef(true);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  useEffect(() => {
    const w = window as Window & {
      webkitSpeechRecognition?: new () => Rec;
      SpeechRecognition?: new () => Rec;
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) {
      setError('当前浏览器不支持语音输入');
      return;
    }
    const recognition = new Ctor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'zh-CN';
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      onTranscriptRef.current(transcript);
      setIsListening(false);
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
          /* use the message below */
        }
      }
      if (code === 'not-allowed') {
        setError('需要麦克风权限才能把您说的话填进输入框');
      } else if (code !== 'aborted' && code !== 'no-speech') {
        setError('无法识别语音');
      }
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
  }, []);

  const toggleListening = () => {
    if (disabled || error === '当前浏览器不支持语音输入') return;
    const recognition = recognitionRef.current;
    if (!recognition) return;
    if (isListening) {
      recognition.stop();
      setIsListening(false);
      return;
    }
    setError(null);
    localAttempt.current = true;
    try {
      if ('processLocally' in recognition) recognition.processLocally = true;
    } catch {
      /* older browsers ignore on-device mode */
    }
    try {
      recognition.start();
      setIsListening(true);
    } catch {
      setError('无法开始语音输入');
      setIsListening(false);
    }
  };

  const label = error ? error : isListening ? '停止语音' : '语音输入';
  const blocked = disabled || error === '当前浏览器不支持语音输入';

  if (appearance === 'toolbar') {
    return (
      <button
        type="button"
        data-testid="voice-mic"
        onClick={toggleListening}
        disabled={blocked}
        aria-label={label}
        title={label}
        className={cn(
          'p-2 rounded-lg transition-colors disabled:opacity-40',
          isListening ? 'text-red-400' : (className ?? 'text-text-secondary hover:bg-background-dark hover:text-primary'),
        )}
      >
        {isListening ? <Square className="w-4 h-4" aria-hidden /> : <Mic className="w-5 h-5" aria-hidden />}
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        data-testid="voice-mic"
        onClick={toggleListening}
        disabled={blocked}
        aria-label={label}
        title={label}
        className={cn(
          'p-3 rounded-full transition-all duration-300 disabled:opacity-40',
          isListening ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100',
          className,
        )}
      >
        {isListening ? <Square className="w-5 h-5" aria-hidden /> : <Mic className="w-5 h-5" aria-hidden />}
      </button>
      {isListening && (
        <span className="absolute -top-8 left-1/2 -translate-x-1/2 text-xs font-bold text-indigo-600 whitespace-nowrap bg-white px-2 py-1 rounded shadow-sm border border-indigo-100">
          正在听
        </span>
      )}
    </div>
  );
}
