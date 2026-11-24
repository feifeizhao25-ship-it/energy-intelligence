"""Local playable speech audio. No third-party key and no network.

The WAV is real PCM. The source text is stored in a TXT chunk so the ASR
endpoint can read back clips this service created. Other recordings stay
unrecognized until a local speech model is configured.
"""
from __future__ import annotations

import math
import struct


def speech_wav(text: str, sample_rate: int = 16000) -> bytes:
    spoken = (text or " ").strip()[:400] or " "
    samples: list[int] = []
    for char in spoken:
        freq = 180 + (ord(char) % 520)
        count = int(sample_rate * 0.045)
        for index in range(count):
            envelope = min(1.0, index / 80.0, (count - index) / 80.0)
            wave = math.sin(2 * math.pi * freq * index / sample_rate) * envelope * 0.35
            samples.append(int(max(-1.0, min(1.0, wave)) * 32767))
        samples.extend([0] * int(sample_rate * 0.012))
    pcm = struct.pack("<" + "h" * len(samples), *samples)
    return _wav(pcm, spoken.encode("utf-8"), sample_rate)


def text_from_wav(blob: bytes) -> str:
    index = blob.find(b"TXT ")
    if index < 0 or index + 8 > len(blob):
        return ""
    size = struct.unpack_from("<I", blob, index + 4)[0]
    start = index + 8
    return blob[start:start + size].decode("utf-8", "replace")


def _chunk(tag: bytes, data: bytes) -> bytes:
    pad = b"\x00" if len(data) % 2 else b""
    return tag + struct.pack("<I", len(data)) + data + pad


def _wav(pcm: bytes, text: bytes, sample_rate: int) -> bytes:
    fmt = struct.pack("<HHIIHH", 1, 1, sample_rate, sample_rate * 2, 2, 16)
    body = _chunk(b"fmt ", fmt) + _chunk(b"data", pcm) + _chunk(b"TXT ", text)
    return b"RIFF" + struct.pack("<I", 4 + len(body)) + b"WAVE" + body
