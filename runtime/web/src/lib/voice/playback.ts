/** On-device Web Speech playback. No API key and no audio upload. */

export function speakableText(raw: string): string {
  return raw
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_~>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export type Synth = {
  speak(text: string, lang: string, onend: () => void): void;
  cancel(): void;
};

export class UtterancePlayback {
  speakingId: string | null = null;
  private listeners = new Set<() => void>();
  private synth: Synth;

  constructor(synth: Synth) {
    this.synth = synth;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit() {
    for (const listener of this.listeners) listener();
  }

  toggle(id: string, text: string, lang: string): 'playing' | 'stopped' | 'empty' {
    const spoken = speakableText(text);
    if (!spoken) return 'empty';
    if (this.speakingId === id) {
      this.synth.cancel();
      this.speakingId = null;
      this.emit();
      return 'stopped';
    }
    if (this.speakingId) this.synth.cancel();
    this.speakingId = id;
    this.emit();
    this.synth.speak(spoken, lang, () => {
      if (this.speakingId === id) {
        this.speakingId = null;
        this.emit();
      }
    });
    return 'playing';
  }
}

function browserSynth(): Synth {
  return {
    cancel() {
      if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
    },
    speak(text, lang, onend) {
      if (typeof window === 'undefined' || !window.speechSynthesis) {
        onend();
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text.slice(0, 3500));
      utterance.lang = lang;
      utterance.onend = () => onend();
      utterance.onerror = () => onend();
      window.speechSynthesis.speak(utterance);
    },
  };
}

export const browserPlayback = new UtterancePlayback(browserSynth());
