export function requireAlt(alt: string): string {
    const text = (alt || '').trim();
    if (!text) throw new Error('图片缺少替代文本');
    return text;
}

/** 图片必须有替代文本。生成图和生成视频都标明人工智能生成。 */
export function MediaFrame({
    alt,
    src,
    generated = false,
    kind = 'image',
}: {
    alt: string;
    src: string;
    generated?: boolean;
    kind?: 'image' | 'video';
}) {
    const label = requireAlt(alt);
    const mark = generated ? (
        <span data-testid="aigc-mark" className="absolute right-2 top-2 rounded bg-black/70 px-2 py-0.5 text-xs text-white">
            人工智能生成
        </span>
    ) : null;
    if (kind === 'video') {
        return (
            <figure className="relative" data-generated={generated ? '1' : '0'}>
                {mark}
                <video controls src={src} aria-label={label} className="w-full rounded-xl" />
                <figcaption className="mt-1 text-xs text-[var(--ink-soft)]">{label}</figcaption>
            </figure>
        );
    }
    return (
        <figure className="relative" data-generated={generated ? '1' : '0'}>
            {mark}
            {/* 尺寸固定，避免未配置图片域名时构建失败。 */}
            <img src={src} alt={label} width={640} height={360} className="w-full rounded-xl" />
            <figcaption className="mt-1 text-xs text-[var(--ink-soft)]">{label}</figcaption>
        </figure>
    );
}
