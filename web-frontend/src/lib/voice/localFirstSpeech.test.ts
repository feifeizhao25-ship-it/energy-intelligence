import { attachLocalFirstRecognition, type SpeechRecognitionLike } from './localFirstSpeech';

function chromeWithoutLocalPack(): SpeechRecognitionLike & { starts: number; localFlags: boolean[] } {
  let open = false;
  const rec = {
    lang: 'zh-CN',
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
      rec.onresult({ results: [[{ transcript: '屋顶光伏回收期' }]] });
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

describe('on-device speech fallback', () => {
  it('retries zh-CN without processLocally after language-not-supported', () => {
    const recognition = chromeWithoutLocalPack();
    const transcripts: string[] = [];
    const failures: string[] = [];
    attachLocalFirstRecognition(recognition, {
      onTranscript: (text) => transcripts.push(text),
      onFailure: (code) => failures.push(code),
    }).start();
    expect(failures).toEqual([]);
    expect(transcripts).toEqual(['屋顶光伏回收期']);
    expect(recognition.starts).toBe(2);
    expect(recognition.localFlags).toEqual([true, false]);
  });
});
