'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';

interface VoiceInputProps {
    onTranscript: (text: string) => void;
    isListening?: boolean;
}

export function VoiceInput({ onTranscript }: VoiceInputProps) {
    const [isListening, setIsListening] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
            const SpeechRecognition = (window as any).webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = false;
            recognitionRef.current.interimResults = false;
            recognitionRef.current.lang = 'zh-CN';

            recognitionRef.current.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                onTranscript(transcript);
                setIsListening(false);
            };

            recognitionRef.current.onerror = (event: any) => {
                console.error('Speech recognition error', event.error);
                setError('无法识别语音');
                setIsListening(false);
            };

            recognitionRef.current.onend = () => {
                setIsListening(false);
            };
        } else {
            setError('浏览器不支持');
        }
    }, [onTranscript]);

    const toggleListening = () => {
        if (error === '浏览器不支持') return;

        if (isListening) {
            recognitionRef.current?.stop();
        } else {
            setError(null);
            recognitionRef.current?.start();
            setIsListening(true);
        }
    };

    if (error === '浏览器不支持') return null;

    return (
        <div className="relative">
            <button
                type="button"
                onClick={toggleListening}
                className={`p-3 rounded-full transition-all duration-300 ${isListening
                        ? 'bg-red-500 text-white shadow-lg shadow-red-500/30 scale-110 animate-pulse'
                        : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                    }`}
                title={isListening ? '点击停止' : '点击说话'}
            >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {isListening && (
                <span className="absolute -top-8 left-1/2 -translate-x-1/2 text-xs font-bold text-indigo-600 whitespace-nowrap bg-white px-2 py-1 rounded shadow-sm border border-indigo-100">
                    正在听...
                </span>
            )}
        </div>
    );
}
