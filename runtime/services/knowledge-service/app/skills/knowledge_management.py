"""Knowledge management skill for the knowledge service.

Retrieves curated energy-industry documents from the knowledge base. In
non-production environments a small built-in demo corpus is used when no
knowledge backend is configured; in production that synthetic fallback is
rejected so unverified demo content can never be served as real data.
"""

import os
from typing import Any, List, Optional


def _production_mode() -> bool:
    return os.getenv("ENVIRONMENT", "").lower() == "production"


class KnowledgeDocument:
    def __init__(self, document_id: str, title: str, category: str,
                 download_url: Optional[str], source_status: str) -> None:
        self.document_id = document_id
        self.title = title
        self.category = category
        self.download_url = download_url
        self.source_status = source_status


_DEMO_CORPUS: List[dict] = [
    {
        "document_id": "demo-pv-market-2026",
        "title": "Demo: 光伏市场概览（占位数据）",
        "category": "solar",
        "download_url": None,
        "source_status": "unverified_demo",
    },
    {
        "document_id": "demo-wind-policy-2026",
        "title": "Demo: 风电政策摘要（占位数据）",
        "category": "wind",
        "download_url": None,
        "source_status": "unverified_demo",
    },
    {
        "document_id": "demo-storage-tech-2026",
        "title": "Demo: 储能技术简报（占位数据）",
        "category": "storage",
        "download_url": None,
        "source_status": "unverified_demo",
    },
]


class KnowledgeManagementSkill:
    """Search and list knowledge-base documents."""

    def __init__(self, skill_id: str = "knowledge_management",
                 backend_url: Optional[str] = None) -> None:
        self.skill_id = skill_id
        self.backend_url = (
            backend_url if backend_url is not None
            else os.getenv("KNOWLEDGE_BACKEND_URL")
        )

    def _demo_documents(self) -> List[KnowledgeDocument]:
        if _production_mode():
            raise RuntimeError(
                "KNOWLEDGE_BACKEND_UNCONFIGURED: "
                "synthetic fallback is disabled in production; "
                "configure KNOWLEDGE_BACKEND_URL so unverified demo "
                "documents are never served as real data"
            )
        return [KnowledgeDocument(**item) for item in _DEMO_CORPUS]

    def list_documents(self, category: Optional[str] = None) -> List[KnowledgeDocument]:
        documents = self._load_documents()
        if category:
            documents = [doc for doc in documents if doc.category == category]
        return documents

    def search(self, query: str) -> List[KnowledgeDocument]:
        documents = self._load_documents()
        needle = query.lower()
        return [
            doc
            for doc in documents
            if needle in doc.title.lower() or needle in doc.category.lower()
        ]

    def _load_documents(self) -> List[KnowledgeDocument]:
        if self.backend_url:
            return self._fetch_from_backend()
        return self._demo_documents()

    def _fetch_from_backend(self) -> List[KnowledgeDocument]:
        import json
        import urllib.request

        with urllib.request.urlopen(self.backend_url, timeout=10) as response:
            payload = json.loads(response.read().decode("utf-8"))
        return [
            KnowledgeDocument(
                document_id=item["document_id"],
                title=item["title"],
                category=item.get("category", "general"),
                download_url=item.get("download_url"),
                source_status=item.get("source_status", "verified"),
            )
            for item in payload.get("documents", [])
        ]


def get_skill() -> KnowledgeManagementSkill:
    return KnowledgeManagementSkill()


def _get_mock_data(category: str):
    """Mock 数据入口已禁用：任何环境调用都直接报错。

    恢复重建原则：合成兜底数据不得作为真实知识库内容返回。
    """
    raise RuntimeError(
        f"synthetic fallback is disabled in production; "
        f"no mock data available for category '{category}'"
    )
