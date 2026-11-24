const clips = new Map<string, Uint8Array>();

export function saveClip(id: string, wav: Uint8Array) {
    if (clips.size > 32) clips.delete(clips.keys().next().value as string);
    clips.set(id, wav);
}

export function readClip(id: string): Uint8Array | undefined {
    return clips.get(id);
}
