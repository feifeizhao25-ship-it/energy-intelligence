'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MIC_UNSUPPORTED, micFailureMessage, micView } from '@/lib/voice/micStatus';
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
      setError(MIC_UNSUPPORTED);
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
        const message = micFailureMessage(code);
        if (message) setError(message);
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
    if (disabled || error === MIC_UNSUPPORTED) return;
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
      setError('无法开始语音输入，请改用键盘输入');
      setIsListening(false);
    }
  };

  const view = micView(error);
  // 浏览器不支持语音识别：不显示话筒（音3），避免点了没反应
  if (view.hidden) return null;
  const label = error ? error : isListening ? '停止语音' : '语音输入';
  const blocked = disabled;
  const hint = view.visibleHint && (
    <span role="status" data-testid="voice-mic-hint" className="text-xs text-amber-500 max-w-[14rem] leading-tight">
      {view.visibleHint}
    </span>
  );

  if (appearance === 'toolbar') {
    return (
      <span className="inline-flex items-center gap-1">
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
      {hint}
      </span>
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
      {hint && <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 whitespace-nowrap">{hint}</div>}
    </div>
  );
}
