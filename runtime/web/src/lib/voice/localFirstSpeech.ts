/**
 * On-device speech recognition (`processLocally`) fails with
 * `language-not-supported` when the browser has no local pack for zh-CN or
 * en-US, and with `network` / `service-not-allowed` when the on-device path
 * cannot run. Retry once without on-device processing so the mic can still
 * produce a transcript. The recognizer must be idle before `start()` — if a
 * restart inside `onerror` throws, it is deferred to `onend`.
 */

export const ON_DEVICE_FALLBACK_ERRORS = ['network', 'service-not-allowed', 'language-not-supported'] as const;

export type SpeechRecognitionLike = {
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

export type LocalFirstSession = {
  /** Returns true when a recognition session is still open after start(). */
  start: () => boolean;
  stop: () => void;
};

const FALLBACK = new Set<string>(ON_DEVICE_FALLBACK_ERRORS);

function transcriptOf(event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }): string {
  const row = event.results[0];
  const alt = row && row[0];
  return alt && typeof alt.transcript === 'string' ? alt.transcript : '';
}

export function attachLocalFirstRecognition(
  recognition: SpeechRecognitionLike,
  handlers: {
    onTranscript: (transcript: string) => void;
    onFailure: (code: string) => void;
    onIdle?: () => void;
  },
): LocalFirstSession {
  let preferLocal = true;
  let retryOnEnd = false;
  let ignoreEnd = false;
  let active = false;

  const beginCloud = () => {
    preferLocal = false;
    retryOnEnd = false;
    if ('processLocally' in recognition) recognition.processLocally = false;
    recognition.start();
  };

  recognition.onresult = (event) => {
    retryOnEnd = false;
    active = false;
    const transcript = transcriptOf(event);
    if (transcript) handlers.onTranscript(transcript);
  };

  recognition.onerror = (event) => {
    const code = event.error || '';
    if (preferLocal && FALLBACK.has(code)) {
      preferLocal = false;
      try {
        ignoreEnd = true;
        beginCloud();
        return;
      } catch {
        ignoreEnd = false;
        retryOnEnd = true;
        return;
      }
    }
    retryOnEnd = false;
    ignoreEnd = false;
    active = false;
    handlers.onFailure(code);
  };

  recognition.onend = () => {
    if (ignoreEnd) {
      ignoreEnd = false;
      return;
    }
    if (retryOnEnd) {
      retryOnEnd = false;
      try {
        beginCloud();
        return;
      } catch {
        active = false;
        handlers.onFailure('language-not-supported');
        handlers.onIdle?.();
      }
      return;
    }
    active = false;
    handlers.onIdle?.();
  };

  return {
    start() {
      preferLocal = true;
      retryOnEnd = false;
      ignoreEnd = false;
      active = true;
      try {
        if ('processLocally' in recognition) recognition.processLocally = true;
      } catch {
        /* engines that reject the flag still recognize in the cloud */
      }
      recognition.start();
      return active;
    },
    stop() {
      preferLocal = false;
      retryOnEnd = false;
      ignoreEnd = false;
      active = false;
      recognition.stop();
    },
  };
}
