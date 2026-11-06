'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Volume2 } from 'lucide-react';
import { browserPlayback, speakableText } from '../../lib/voice/playback';
import { attachLocalFirstRecognition, type LocalFirstSession, type SpeechRecognitionLike } from '../../lib/voice/localFirstSpeech';

/** Icon button matched to the analyst form's 40px field. */
export function AnalystMic({
  disabled,
  onTranscript,
}: {
  disabled?: boolean;
  onTranscript: (text: string) => void;
}) {
  const [listening, setListening] = useState(false);
  const [hint, setHint] = useState('Voice input');
  const recRef = useRef<LocalFirstSession | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  useEffect(() => {
    const w = window as Window & {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) {
      setHint('Voice input is not available in this browser');
      return;
    }
    const recognition = new Ctor();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;
    const session = attachLocalFirstRecognition(recognition, {
      onTranscript: (transcript) => {
        onTranscriptRef.current(transcript);
        setListening(false);
        setHint('Voice input');
      },
      onFailure: (code) => {
        setHint(code === 'not-allowed' ? 'Allow the microphone to dictate a question' : 'Could not recognize speech');
        setListening(false);
      },
      onIdle: () => {
        setListening(false);
        setHint((current) => (current === 'Stop voice input' ? 'Voice input' : current));
      },
    });
    recRef.current = session;
    return () => {
      try { session.stop(); } catch { /* recognizer was already idle */ }
    };
  }, []);

  const toggle = () => {
    const recognition = recRef.current;
    if (!recognition || disabled || hint.startsWith('Voice input is not available')) return;
    if (listening) {
      recognition.stop();
      setListening(false);
      setHint('Voice input');
      return;
    }
    try {
      const stillListening = recognition.start();
      setListening(stillListening);
      // A synchronous failure already set the hint. Don't replace it with the idle label.
      if (stillListening) setHint('Stop voice input');
    } catch {
      setListening(false);
      setHint('Could not start voice input');
    }
  };

  const label = listening ? 'Stop voice input' : hint;
  return (
    <button
      type="button"
      data-testid="voice-mic"
      onClick={toggle}
      disabled={disabled || hint.startsWith('Voice input is not available')}
      aria-label={label}
      title={label}
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--color-brand-500)] disabled:opacity-40"
    >
      {listening ? <Square size={14} aria-hidden /> : <Mic size={16} aria-hidden />}
    </button>
  );
}

/** Quiet readout control under an analyst answer. */
export function AnalystSpeaker({ id, text }: { id: string; text: string }) {
  const spoken = speakableText(text);
  const [playing, setPlaying] = useState(false);
  useEffect(() => browserPlayback.subscribe(() => setPlaying(browserPlayback.speakingId === id)), [id]);
  if (!spoken) return null;
  const label = playing ? 'Stop reading' : 'Read aloud';
  return (
    <button
      type="button"
      data-testid="voice-speak"
      aria-label={label}
      title={label}
      onClick={() => browserPlayback.toggle(id, text, 'en-US')}
      className="mt-1 inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-tertiary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
    >
      {playing ? <Square size={12} aria-hidden /> : <Volume2 size={14} aria-hidden />}
    </button>
  );
}
