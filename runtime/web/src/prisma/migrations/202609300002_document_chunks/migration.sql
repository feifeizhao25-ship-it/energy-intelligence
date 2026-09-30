-- 文献向量库落自建 PostgreSQL：替代原来写 Supabase 的 document_chunks。
-- 向量用 double precision[]，相似度在应用内算，不需要 pgvector 扩展。
CREATE TABLE IF NOT EXISTS "document_chunks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" DOUBLE PRECISION[],
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "document_chunks_userId_documentId_idx" ON "document_chunks"("userId", "documentId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_chunks_userId_fkey') THEN
    ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
