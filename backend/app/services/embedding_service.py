def _build_embedding_service() -> EmbeddingService:
    provider = settings.EMBEDDING_PROVIDER.lower()
    explicit_key = settings.EMBEDDING_API_KEY or os.getenv("EMBEDDING_API_KEY")
    explicit_base = settings.EMBEDDING_API_BASE or os.getenv("EMBEDDING_API_BASE")

    if settings.ENVIRONMENT in {"test", "testing"} or os.getenv("PYTEST_CURRENT_TEST"):
        return BGEM3EmbeddingService(dimensions=settings.EMBEDDING_DIMENSIONS)

    if provider in {"openai", "auto"} and settings.OPENAI_API_KEY:
        return OpenAICompatibleEmbeddingService(
