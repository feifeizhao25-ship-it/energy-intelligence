'use client';

/**
 * MultimodalInput — attach an image or audio clip to a question; audio is
 * transcribed through the ASR endpoint before submission.
 */

import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002').replace(/\/$/, '');

export interface MultimodalInputProps {
  onTranscript: (text: string) => void;
  onError?: (message: string) => void;
}

export const MultimodalInput: React.FC<MultimodalInputProps> = ({ onTranscript, onError }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<string | null>(null);

  async function transcribe(file: File) {
    setPending(file.name);
    try {
      const form = new FormData();
      form.append('file', file);
      const r = await fetch(`${API_BASE}/api/v1/voice/asr`, { method: 'POST', body: form });
      if (!r.ok) {
        throw new Error(`ASR endpoint returned ${r.status}`);
      }
      const payload = (await r.json()) as { text?: string };
      if (payload.text) {
        onTranscript(payload.text);
      } else {
        throw new Error('ASR endpoint returned no transcript');
      }
    } catch (error) {
      onError?.(error instanceof Error ? error.message : String(error));
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={fileRef}
        type="file"
        accept="audio/*,video/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void transcribe(file);
          }
          event.target.value = '';
        }}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border-default)] px-3 text-[13px] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
      >
        🎙️ Voice / media
      </button>
      <AnimatePresence>
        {pending && (
          <motion.span
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-[12px] text-[var(--text-tertiary)]"
          >
            Transcribing {pending}…
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MultimodalInput;
