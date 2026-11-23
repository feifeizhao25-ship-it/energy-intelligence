/** On-device Web Speech playback. No API key and no audio upload. */

export function speakableText(raw: string): string {
  return raw
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/[^\s，。；）)]+/g, '（网址见屏幕）')
    .replace(/\s*\[(\d{1,2})]/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_~>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 朗读只读回答正文（音1）：来源块（标题、网址、许可、摘录）留在屏幕上，不进朗读，最后只提一句有几条来源。
 * 以前把 citationText（正文 + 全部来源块）整段送去朗读，89 字的回答连来源要读约 8 分钟。
 */
export function spokenAnswerText(body: string, sourceCount = 0): string {
  const spoken = speakableText(body);
  if (!spoken) return '';
  return sourceCount > 0 ? `${spoken} 本回答附 ${sourceCount} 条来源，请看屏幕。` : spoken;
}

/** 朗读结束时的结果：undefined = 正常读完或被用户停止；其余是失败原因。 */
export type SpeakFailure = 'unsupported' | 'no-voice' | 'not-allowed' | 'error';

export function speakFailureMessage(code: SpeakFailure): string {
  switch (code) {
    case 'unsupported':
      return '这个浏览器不支持朗读';
    case 'no-voice':
      return '本机没有可用的中文语音，无法朗读';
    case 'not-allowed':
      return '浏览器没有允许朗读，请再点一次';
    default:
      return '朗读没有成功，请稍后再试';
  }
}

export type Synth = {
  speak(text: string, lang: string, onend: (failure?: SpeakFailure) => void): void;
  cancel(): void;
};

export class UtterancePlayback {
  speakingId: string | null = null;
  /** 最近一次朗读失败（音2）：按钮旁显示文字，不再默默变回「朗读」。 */
  lastError: { id: string; message: string } | null = null;
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
    this.lastError = null;
    this.emit();
    this.synth.speak(spoken, lang, (failure) => {
      if (this.speakingId === id) {
        this.speakingId = null;
        if (failure) this.lastError = { id, message: speakFailureMessage(failure) };
        this.emit();
      }
    });
    return 'playing';
  }
}

/** 浏览器 SpeechSynthesisErrorEvent.error → 失败类型；用户停止或切换（interrupted / canceled）不算失败。 */
export function classifySpeechError(code: string | undefined): SpeakFailure | undefined {
  if (code === 'interrupted' || code === 'canceled') return undefined;
  if (code === 'language-unavailable' || code === 'voice-unavailable') return 'no-voice';
  if (code === 'not-allowed') return 'not-allowed';
  if (code === 'synthesis-unavailable') return 'unsupported';
  return 'error';
}

function browserSynth(): Synth {
  return {
    cancel() {
      if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
    },
    speak(text, lang, onend) {
      if (typeof window === 'undefined' || !window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') {
        onend('unsupported');
        return;
      }
      const voices = window.speechSynthesis.getVoices?.() ?? [];
      const prefix = lang.slice(0, 2).toLowerCase();
      // 声音列表可能还没加载完（长度 0），这时不下结论，交给引擎的 onerror。
      if (voices.length > 0 && !voices.some((voice) => voice.lang?.toLowerCase().replace('_', '-').startsWith(prefix))) {
        onend('no-voice');
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text.slice(0, 3500));
      utterance.lang = lang;
      utterance.onend = () => onend();
      utterance.onerror = (event: SpeechSynthesisErrorEvent) => onend(classifySpeechError(event?.error));
      window.speechSynthesis.speak(utterance);
    },
  };
}

export const browserPlayback = new UtterancePlayback(browserSynth());
