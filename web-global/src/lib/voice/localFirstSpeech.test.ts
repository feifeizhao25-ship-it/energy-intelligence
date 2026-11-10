import { describe, expect, it } from 'vitest';

import { attachLocalFirstRecognition, type SpeechRecognitionLike } from './localFirstSpeech';
import { attachLocalFirstRecognition as attachCnShell } from '../../../../frontend-cn-web/src/lib/voice/localFirstSpeech';
import { attachLocalFirstRecognition as attachRuntime } from '../../../../runtime/web/src/lib/voice/localFirstSpeech';
import { attachLocalFirstRecognition as attachWebFrontend } from '../../../../web-frontend/src/lib/voice/localFirstSpeech';

type Attach = typeof attachLocalFirstRecognition;

/**
 * A recognizer that fails on-device recognition the way Chrome does when the
 * language pack is missing, then succeeds once processLocally is turned off.
 * onerror runs before onend, and start() while the session is still open throws.
 */
function chromeWithoutLocalPack(lang: string): SpeechRecognitionLike & { starts: number; localFlags: boolean[] } {
  let open = false;
  const rec: SpeechRecognitionLike & { starts: number; localFlags: boolean[] } = {
    lang,
    continuous: false,
    interimResults: false,
    processLocally: false,
    starts: 0,
    localFlags: [] as boolean[],
    onresult: () => {},
    onerror: () => {},
    onend: () => {},
    start() {
      if (open) throw new Error('recognition already started');
      open = true;
      rec.starts += 1;
      rec.localFlags.push(Boolean(rec.processLocally));
      if (rec.processLocally) {
        rec.onerror({ error: 'language-not-supported' });
        open = false;
        rec.onend();
        return;
      }
      rec.onresult({ results: [[{ transcript: lang === 'zh-CN' ? '屋顶光伏回收期' : 'rooftop solar payback' }]] });
      open = false;
      rec.onend();
    },
    stop() {
      if (!open) return;
      open = false;
      rec.onend();
    },
  };
  return rec;
}

function runFallback(attach: Attach, lang: 'zh-CN' | 'en-US') {
  const recognition = chromeWithoutLocalPack(lang);
  const transcripts: string[] = [];
  const failures: string[] = [];
  const session = attach(recognition, {
    onTranscript: (text) => transcripts.push(text),
    onFailure: (code) => failures.push(code),
  });
  recognition.lang = lang;
  session.start();
  return { recognition, transcripts, failures };
}

describe.each([
  ['web-global', attachLocalFirstRecognition],
  ['frontend-cn-web', attachCnShell],
  ['runtime/web', attachRuntime],
  ['web-frontend', attachWebFrontend],
] as const)('%s speech recognition', (_name, attach) => {
  it('retries en-US without on-device processing after language-not-supported', () => {
    const { recognition, transcripts, failures } = runFallback(attach, 'en-US');
    expect(failures).toEqual([]);
    expect(transcripts).toEqual(['rooftop solar payback']);
    expect(recognition.starts).toBe(2);
    expect(recognition.localFlags).toEqual([true, false]);
  });

  it('retries zh-CN without on-device processing after language-not-supported', () => {
    const { recognition, transcripts, failures } = runFallback(attach, 'zh-CN');
    expect(failures).toEqual([]);
    expect(transcripts).toEqual(['屋顶光伏回收期']);
    expect(recognition.starts).toBe(2);
    expect(recognition.localFlags).toEqual([true, false]);
  });

  it('does not retry a permission error', () => {
    const recognition = chromeWithoutLocalPack('en-US');
    recognition.start = function start() {
      recognition.starts += 1;
      recognition.onerror({ error: 'not-allowed' });
      recognition.onend();
    };
    const failures: string[] = [];
    const session = attach(recognition, {
      onTranscript: () => { throw new Error('should not hear audio'); },
      onFailure: (code) => failures.push(code),
    });
    session.start();
    expect(failures).toEqual(['not-allowed']);
    expect(recognition.starts).toBe(1);
  });
});
