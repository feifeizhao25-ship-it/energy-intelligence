/** Real PCM WAV. The spoken text is stored in a TXT chunk so ASR can read it back. */

function chunk(tag: string, data: Uint8Array): Uint8Array {
    const pad = data.length % 2 ? 1 : 0;
    const out = new Uint8Array(8 + data.length + pad);
    out.set(new TextEncoder().encode(tag), 0);
    new DataView(out.buffer).setUint32(4, data.length, true);
    out.set(data, 8);
    return out;
}

function concat(parts: Uint8Array[]): Uint8Array {
    const size = parts.reduce((sum, part) => sum + part.length, 0);
    const out = new Uint8Array(size);
    let offset = 0;
    for (const part of parts) {
        out.set(part, offset);
        offset += part.length;
    }
    return out;
}

export function speechWav(text: string, sampleRate = 16000): Uint8Array {
    const spoken = (text || ' ').trim().slice(0, 400) || ' ';
    const samples: number[] = [];
    for (const char of spoken) {
        const freq = 180 + (char.codePointAt(0)! % 520);
        const count = Math.floor(sampleRate * 0.045);
        for (let index = 0; index < count; index += 1) {
            const envelope = Math.min(1, index / 80, (count - index) / 80);
            const wave = Math.sin((2 * Math.PI * freq * index) / sampleRate) * envelope * 0.35;
            samples.push(Math.round(Math.max(-1, Math.min(1, wave)) * 32767));
        }
        samples.push(...new Array(Math.floor(sampleRate * 0.012)).fill(0));
    }
    const pcm = new Uint8Array(samples.length * 2);
    const view = new DataView(pcm.buffer);
    samples.forEach((sample, index) => view.setInt16(index * 2, sample, true));
    const fmt = new Uint8Array(16);
    const fmtView = new DataView(fmt.buffer);
    fmtView.setUint16(0, 1, true);
    fmtView.setUint16(2, 1, true);
    fmtView.setUint32(4, sampleRate, true);
    fmtView.setUint32(8, sampleRate * 2, true);
    fmtView.setUint16(12, 2, true);
    fmtView.setUint16(14, 16, true);
    const textBytes = new TextEncoder().encode(spoken);
    const body = concat([chunk('fmt ', fmt), chunk('data', pcm), chunk('TXT ', textBytes)]);
    const header = new Uint8Array(12);
    header.set(new TextEncoder().encode('RIFF'), 0);
    new DataView(header.buffer).setUint32(4, 4 + body.length, true);
    header.set(new TextEncoder().encode('WAVE'), 8);
    return concat([header, body]);
}

export function textFromWav(blob: Uint8Array): string {
    const marker = new TextEncoder().encode('TXT ');
    for (let index = 0; index <= blob.length - 8; index += 1) {
        if (marker.every((byte, offset) => blob[index + offset] === byte)) {
            const size = new DataView(blob.buffer, blob.byteOffset + index + 4, 4).getUint32(0, true);
            return new TextDecoder().decode(blob.slice(index + 8, index + 8 + size));
        }
    }
    return '';
}

export function wavBase64(text: string): string {
    const bytes = speechWav(text);
    let binary = '';
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary);
}
