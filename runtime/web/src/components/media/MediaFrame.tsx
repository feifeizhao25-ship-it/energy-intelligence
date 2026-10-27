'use client';

import { useEffect, useRef, useState } from 'react';

export function requireAlt(alt: string): string {
    const text = (alt || '').trim();
    if (!text) throw new Error('图片缺少替代文本');
    return text;
}

function isStream(src: string): boolean {
    return /\.m3u8($|\?)/i.test(src);
}

/** 图片必须有替代文本。生成图和生成视频都标明人工智能生成。流地址用 hls.js，浏览器自带则直接播放。 */
export function MediaFrame({
    alt,
    src,
    generated = false,
    kind = 'image',
    poster,
    captions,
}: {
    alt: string;
    src: string;
    generated?: boolean;
    kind?: 'image' | 'video';
    poster?: string;
    captions?: string;
}) {
    const label = requireAlt(alt);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [playerNote, setPlayerNote] = useState('');
    const mark = generated ? (
        <span data-testid="aigc-mark" className="absolute right-2 top-2 rounded bg-black/70 px-2 py-0.5 text-xs text-white">
            人工智能生成
        </span>
    ) : null;
    useEffect(() => {
        const video = videoRef.current;
        if (!video || kind !== 'video' || !isStream(src)) return;
        let cancelled = false;
        let hls: { destroy: () => void } | null = null;
        const native = video.canPlayType('application/vnd.apple.mpegurl');
        if (native) {
            video.src = src;
            return;
        }
        import('hls.js')
            .then(({ default: Hls }) => {
                if (cancelled) return;
                if (!Hls.isSupported()) {
                    setPlayerNote('当前浏览器不能播放该视频流');
                    return;
                }
                const player = new Hls();
                player.loadSource(src);
                player.attachMedia(video);
                hls = player;
            })
            .catch(() => {
                if (!cancelled) setPlayerNote('视频流播放器未加载');
            });
        return () => {
            cancelled = true;
            hls?.destroy();
        };
    }, [kind, src]);
    if (kind === 'video') {
        return (
            <figure className="relative" data-generated={generated ? '1' : '0'}>
                {mark}
                <video
                    ref={videoRef}
                    controls
                    poster={poster}
                    src={isStream(src) ? undefined : src}
                    aria-label={label}
                    className="w-full rounded-xl bg-black"
                >
                    {captions ? <track kind="captions" src={captions} srcLang="zh" label="中文字幕" default /> : null}
                </video>
                <figcaption className="mt-1 text-xs text-[var(--ink-soft)]">{label}</figcaption>
                {playerNote ? <p className="text-xs text-amber-800">{playerNote}</p> : null}
            </figure>
        );
    }
    return (
        <figure className="relative" data-generated={generated ? '1' : '0'}>
            {mark}
            <img src={src} alt={label} width={640} height={360} className="h-auto w-full rounded-xl" />
            <figcaption className="mt-1 text-xs text-[var(--ink-soft)]">{label}</figcaption>
        </figure>
    );
}
