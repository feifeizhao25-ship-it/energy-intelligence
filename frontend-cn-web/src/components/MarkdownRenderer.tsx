/**
 * MarkdownRenderer — 国内版 AI 对话的 Markdown 渲染器。
 *
 * 在 react-markdown 之上做两层增强：
 * - 图片: 常规 <img>，懒加载
 * - 音视频: <audio>/<video> 标签或 audio:// / video:// 协议
 */

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const ImageBlock: React.FC<{ src: string; alt?: string }> = ({ src, alt }) => (
  <span className="my-3 block">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img
      src={src}
      alt={alt ?? ''}
      loading="lazy"
      className="max-w-full rounded-xl border border-[var(--border-default,#e5e7eb)]"
    />
    {alt && (
      <span className="mt-1 block text-center text-xs text-[var(--text-tertiary,#94a3b8)]">
        {alt}
      </span>
    )}
  </span>
);

const VideoBlock: React.FC<{ src: string; alt?: string }> = ({ src, alt }) => {
  let videoSrc = src;
  if (videoSrc.startsWith('video://')) {
    videoSrc = videoSrc.replace('video://', '');
  }

  return (
    <div className="my-3 rounded-xl border border-[var(--border-default,#e5e7eb)] bg-[var(--bg-secondary,#f9fafb)] p-3">
      {alt && (
        <p className="mb-2 text-xs font-medium text-[var(--text-secondary,#475569)]">{alt}</p>
      )}
      <video src={videoSrc} controls preload="metadata" className="w-full rounded-lg">
        {alt && <span>{alt}</span>}
      </video>
    </div>
  );
};

const AudioBlock: React.FC<{ src: string; alt?: string }> = ({ src, alt }) => {
  let audioSrc = src;
  if (audioSrc.startsWith('audio://')) {
    audioSrc = audioSrc.replace('audio://', '');
  }

  return (
    <div className="my-3 rounded-xl border border-[var(--border-default,#e5e7eb)] bg-[var(--bg-secondary,#f9fafb)] p-3">
      {alt && (
        <p className="mb-2 text-xs font-medium text-[var(--text-secondary,#475569)]">{alt}</p>
      )}
      <audio src={audioSrc} controls preload="metadata" className="w-full">
        {alt && <span>{alt}</span>}
      </audio>
    </div>
  );
};

/** 预处理:把 HTML 媒体标签与自定义协议统一改写成图片语法,便于 img 渲染钩子拦截。 */
function preprocessMedia(markdown: string): string {
  let processed = markdown;

  // 将 HTML <video src="xxx" /> 转为媒体图片语法，方便统一拦截
  processed = processed.replace(
    /<video[^>]*\bsrc=["']([^"']+)["'][^>]*\/?>/gi,
    (_, url) => `![video](${url})`
  );

  processed = processed.replace(
    /<audio[^>]*\bsrc=["']([^"']+)["'][^>]*\/?>/gi,
    (_, url) => `![audio](${url})`
  );

  // 将 video:// 协议转为标记
  processed = processed.replace(
    /video:\/\/([^\s)]+)/g,
    (_, url) => `![video](${url})`
  );

  processed = processed.replace(
    /audio:\/\/([^\s)]+)/g,
    (_, url) => `![audio](${url})`
  );

  return processed;
}

const components = {
  // 图片渲染
  img: ({ src, alt }: { src?: string; alt?: string }) => {
    const url = src || '';
    const label = (alt || '').toLowerCase();
    if (label.includes('video') || /\.(mp4|webm|mov)(\?|$)/i.test(url)) {
      return <VideoBlock src={url} alt={alt} />;
    }
    if (label.includes('audio') || /\.(mp3|wav|ogg|m4a)(\?|$)/i.test(url)) {
      return <AudioBlock src={url} alt={alt} />;
    }
    return <ImageBlock src={src || ''} alt={alt} />;
  },
  // 段落
  p: ({ children }: { children?: React.ReactNode }) => {
    return <p className="my-1.5 leading-relaxed">{children}</p>;
  },
};

export interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className }) => (
  <div className={className}>
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {preprocessMedia(content)}
    </ReactMarkdown>
  </div>
);

export default MarkdownRenderer;
