"""
文件存储服务 — 骨架实现
支持: 阿里云 OSS / 本地存储
"""
import os, uuid, logging
from pathlib import Path
from typing import Optional
from app.config import settings

logger = logging.getLogger(__name__)

# 锚定到 backend 根目录,避免依赖进程 cwd
_BACKEND_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_UPLOAD_DIR = str(_BACKEND_ROOT / "uploads")


class StorageService:
    def __init__(self):
        self.provider = os.getenv("STORAGE_PROVIDER", "local")
        self.local_path = os.getenv("STORAGE_LOCAL_PATH", DEFAULT_UPLOAD_DIR)
        self.oss_bucket = os.getenv("OSS_BUCKET", "")
        self.oss_endpoint = os.getenv("OSS_ENDPOINT", "")
        self.oss_access_key = os.getenv("OSS_ACCESS_KEY_ID", "")
        self.oss_access_secret = os.getenv("OSS_ACCESS_KEY_SECRET", "")
        if settings.ENVIRONMENT == "production":
            if self.provider != "oss":
                raise RuntimeError("Production STORAGE_PROVIDER must be oss; local storage is not durable")
            required = {
                "OSS_BUCKET": self.oss_bucket,
                "OSS_ENDPOINT": self.oss_endpoint,
                "OSS_ACCESS_KEY_ID": self.oss_access_key,
                "OSS_ACCESS_KEY_SECRET": self.oss_access_secret,
            }
            missing = [key for key, value in required.items() if not value]
            if missing:
                raise RuntimeError(
                    "Production object storage configuration is incomplete: " + ", ".join(missing)
                )

    async def upload(self, file_data: bytes, filename: str, content_type: str = "") -> str:
        """上传文件，返回URL"""
        ext = os.path.splitext(filename)[1]
        key = f"{uuid.uuid4().hex}{ext}"

        if self.provider == "oss" and self.oss_bucket:
            try:
                import oss2
                auth = oss2.Auth(self.oss_access_key, self.oss_access_secret)
                bucket = oss2.Bucket(auth, self.oss_endpoint, self.oss_bucket)
                bucket.put_object(key, file_data)
                return f"https://{self.oss_bucket}.{self.oss_endpoint}/{key}"
            except ImportError:
                if settings.ENVIRONMENT == "production":
                    raise RuntimeError("oss2 is required for production object storage")
                logger.warning("oss2 not installed, falling back to local storage")
            except Exception as e:
                if settings.ENVIRONMENT == "production":
                    raise RuntimeError("Production object storage upload failed") from e
                logger.error(f"OSS upload failed: {e}, falling back to local")

        if settings.ENVIRONMENT == "production":
            raise RuntimeError("Local storage fallback is disabled in production")

        os.makedirs(self.local_path, exist_ok=True)
        filepath = os.path.join(self.local_path, key)
        with open(filepath, "wb") as f:
            f.write(file_data)
        return f"/uploads/{key}"


storage_service = StorageService()
