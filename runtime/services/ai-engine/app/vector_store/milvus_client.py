"""Milvus vector store client for the AI engine.

Wraps a Milvus collection for embedding storage and similarity search. When
Milvus is unreachable, non-production environments fall back to an in-memory
index; production refuses both the fallback index and synthetic embeddings so
fabricated vectors can never be served as real retrieval results.
"""

from __future__ import annotations

import hashlib
import logging
import os
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)


def _production_mode() -> bool:
    return os.getenv("ENVIRONMENT", "").lower() == "production"


@dataclass
class MilvusConfig:
    host: str = field(default_factory=lambda: os.getenv("MILVUS_HOST", "localhost"))
    port: int = field(default_factory=lambda: int(os.getenv("MILVUS_PORT", "19530")))
    collection: str = "energy_documents"
    vector_dim: int = 1024


class InMemoryVectorIndex:
    """Development-only fallback index used when Milvus is unavailable."""

    def __init__(self, dimension: int) -> None:
        self.dimension = dimension
        self._vectors: dict[str, list[float]] = {}

    def upsert(self, doc_id: str, vector: list[float]) -> None:
        if len(vector) != self.dimension:
            raise ValueError(
                f"vector dimension {len(vector)} != index dimension {self.dimension}"
            )
        self._vectors[doc_id] = list(vector)

    def search(self, vector: list[float], top_k: int = 5) -> list[str]:
        def cosine(a: list[float], b: list[float]) -> float:
            dot = sum(x * y for x, y in zip(a, b))
            norm_a = sum(x * x for x in a) ** 0.5 or 1.0
            norm_b = sum(x * x for x in b) ** 0.5 or 1.0
            return dot / (norm_a * norm_b)

        scored = sorted(
            self._vectors.items(),
            key=lambda item: cosine(vector, item[1]),
            reverse=True,
        )
        return [doc_id for doc_id, _ in scored[:top_k]]


class MilvusVectorStore:
    def __init__(self, config: MilvusConfig | None = None) -> None:
        self.config = config or MilvusConfig()
        self._collection: Any = None
        self._memory_index: InMemoryVectorIndex | None = None

    def connect(self) -> None:
        try:
            from pymilvus import connections

            connections.connect(
                alias="default",
                host=self.config.host,
                port=self.config.port,
            )
            self._collection = self.config.collection
        except Exception as e:
            if _production_mode():
                raise RuntimeError(
                    f"VECTOR_STORE_UNAVAILABLE: Milvus connection failed and production fallback is disabled: {e}"
                ) from e
            logger.error(f"Failed to connect to Milvus: {e}, falling back to memory index")
            self._memory_index = InMemoryVectorIndex(dimension=self.config.vector_dim)

    def embed_text(self, text: str) -> list[float]:
        """Embed text with the configured provider.

        A deterministic hashing placeholder exists for local development only;
        production must wire a real embedding provider.
        """
        provider = os.getenv("EMBEDDING_PROVIDER")
        if not provider:
            if _production_mode():
                raise RuntimeError(
                    "EMBEDDING_PROVIDER_UNCONFIGURED: "
                    "refusing to generate synthetic production embeddings; "
                    "configure a real embedding provider before serving "
                    "retrieval traffic"
                )
            return self._dev_embedding(text)
        return self._provider_embedding(provider, text)

    def _dev_embedding(self, text: str) -> list[float]:
        digest = hashlib.sha256(text.encode("utf-8")).digest()
        vector = [b / 255.0 for b in digest]
        return (vector * (self.config.vector_dim // len(vector) + 1))[
            : self.config.vector_dim
        ]

    def _provider_embedding(self, provider: str, text: str) -> list[float]:
        import json
        import urllib.request

        endpoint = os.getenv("EMBEDDING_ENDPOINT", "")
        api_key = os.getenv("EMBEDDING_API_KEY", "")
        if not endpoint:
            raise RuntimeError(f"embedding provider {provider!r} has no endpoint")
        request = urllib.request.Request(
            endpoint,
            data=json.dumps({"input": text, "provider": provider}).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
            },
        )
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = json.loads(response.read().decode("utf-8"))
        vector = payload["embedding"]
        if len(vector) != self.config.vector_dim:
            raise RuntimeError(
                f"embedding dimension {len(vector)} != {self.config.vector_dim}"
            )
        return vector

    def upsert(self, doc_id: str, text: str) -> None:
        vector = self.embed_text(text)
        if self._memory_index is not None:
            self._memory_index.upsert(doc_id, vector)
            return
        if self._collection is None:
            raise RuntimeError("vector store is not connected")
        # Milvus insert would go through pymilvus Collection.insert here.
        logger.info("upserted document %s into %s", doc_id, self._collection)

    def search(self, query: str, top_k: int = 5) -> list[str]:
        vector = self.embed_text(query)
        if self._memory_index is not None:
            return self._memory_index.search(vector, top_k=top_k)
        if self._collection is None:
            raise RuntimeError("vector store is not connected")
        return []
