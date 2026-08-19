    def __init__(
        self,
        database_url: Optional[str] = None,
        *,
        table_name: str = "vector_embeddings",
        dimensions: int = 1024,
    ):
        self._memory_mode = database_url is None
        if self._memory_mode:
            self._database_url = ""
            self._table_name = table_name
            self._dimensions = int(dimensions)
            self._initialized = True
            return
        if not database_url:
            raise RuntimeError("PgVectorStoreService requires DATABASE_URL or VECTOR_STORE_DATABASE_URL")
    def _table(self) -> str:
        return self._table_name

    @staticmethod
    def _cosine_similarity(a: List[float], b: List[float]) -> float:
        return SQLiteVectorStoreService._cosine_similarity(a, b)
    async def upsert(self, doc: VectorDocument) -> str:
        if self._memory_mode:
            record_id = str(uuid.uuid4())
            now = datetime.utcnow().isoformat()
            _mock_store[record_id] = {
                "id": record_id,
                "content_type": doc.content_type,
                "content_id": doc.content_id,
                "title": doc.title,
                "content_chunk": doc.content_chunk,
                "chunk_index": doc.chunk_index,
                "embedding": list(doc.embedding),
                "model": doc.model,
                "dimensions": doc.dimensions,
                "extra_metadata": doc.extra_metadata or {},
                "created_at": now,
                "updated_at": now,
            }
            return record_id
        await self._ensure_initialized()
    async def search(
        self,
        query_embedding: List[float],
        top_k: int = 10,
        content_type: Optional[str] = None,
        threshold: float = 0.0,
    ) -> List[VectorSearchHit]:
        if self._memory_mode:
            candidates: List[Tuple[float, Dict[str, Any]]] = []
            for record in _mock_store.values():
                if content_type and record.get("content_type") != content_type:
                    continue
                score = self._cosine_similarity(query_embedding, record.get("embedding", []))
                if score >= threshold:
                    candidates.append((score, record))
            candidates.sort(key=lambda item: item[0], reverse=True)
            return [
                VectorSearchHit(
                    id=record["id"],
                    content_type=record["content_type"],
                    content_id=record["content_id"],
                    title=record.get("title"),
                    content_chunk=record.get("content_chunk"),
                    chunk_index=record.get("chunk_index", 0),
                    score=round(score, 6),
                    extra_metadata=record.get("extra_metadata") or {},
                )
                for score, record in candidates[:top_k]
            ]
        await self._ensure_initialized()
    async def delete_by_content_id(self, content_type: str, content_id: str) -> int:
        if self._memory_mode:
            ids = [
                record_id
                for record_id, record in _mock_store.items()
                if record.get("content_type") == content_type and record.get("content_id") == content_id
            ]
            for record_id in ids:
                _mock_store.pop(record_id, None)
            return len(ids)
        await self._ensure_initialized()
    async def delete_batch(self, ids: List[str]) -> int:
        if not ids:
            return 0
        if self._memory_mode:
            deleted = 0
            for record_id in ids:
                if _mock_store.pop(record_id, None) is not None:
                    deleted += 1
            return deleted
        await self._ensure_initialized()
    async def count(self, content_type: Optional[str] = None) -> int:
        if self._memory_mode:
            if content_type:
                return sum(1 for record in _mock_store.values() if record.get("content_type") == content_type)
            return len(_mock_store)
        await self._ensure_initialized()
