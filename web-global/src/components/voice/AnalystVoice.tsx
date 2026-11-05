'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Volume2 } from 'lucide-react';
import { browserPlayback, speakableText } from '../../lib/voice/playback';

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
  const recRef = useRef<Rec | null>(null);
  const localAttempt = useRef(true);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  useEffect(() => {
    const w = window as Window & { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) {
      setHint('Voice input is not available in this browser');
      return;
    }
    const recognition = new Ctor();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      onTranscriptRef.current(event.results[0][0].transcript);
      setListening(false);
      setHint('Voice input');
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
      setHint(code === 'not-allowed' ? 'Allow the microphone to dictate a question' : 'Could not recognize speech');
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recRef.current = recognition;
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
    localAttempt.current = true;
    try {
      if ('processLocally' in recognition) recognition.processLocally = true;
      recognition.start();
      setListening(true);
      setHint('Stop voice input');
    } catch {
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
