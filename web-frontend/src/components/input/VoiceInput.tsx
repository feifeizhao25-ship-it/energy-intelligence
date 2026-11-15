'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { attachLocalFirstRecognition, type LocalFirstSession, type SpeechRecognitionLike } from '@/lib/voice/localFirstSpeech';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  /** fab: guided flows. toolbar: icon inside an existing composer. */
  appearance?: 'fab' | 'toolbar';
  disabled?: boolean;
  className?: string;
}

/**
 * Browser speech recognition for Chinese chat composers.
 * Prefers on-device recognition when the browser exposes `processLocally`,
 * and retries once in the cloud when that mode cannot run (including
 * `language-not-supported` for zh-CN). No app speech key is stored or sent.
 */
export function VoiceInput({ onTranscript, appearance = 'fab', disabled = false, className }: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<LocalFirstSession | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  useEffect(() => {
    const w = window as Window & {
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
      SpeechRecognition?: new () => SpeechRecognitionLike;
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
    const session = attachLocalFirstRecognition(recognition, {
      onTranscript: (transcript) => {
        onTranscriptRef.current(transcript);
        setIsListening(false);
      },
      onFailure: (code) => {
        if (code === 'not-allowed') {
          setError('需要麦克风权限才能把您说的话填进输入框');
        } else if (code !== 'aborted' && code !== 'no-speech') {
          setError('无法识别语音');
        }
        setIsListening(false);
      },
      onIdle: () => setIsListening(false),
    });
    recognitionRef.current = session;
    return () => {
      try { session.stop(); } catch { /* recognizer was already idle */ }
    };
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
    try {
      setIsListening(recognition.start());
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
