"""
配置管理 - 支持多环境
"""

import os
import warnings
from functools import lru_cache
from typing import List, Optional, Dict, Union

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_DEVELOPMENT_SECRET = "dev-secret-key-must-be-at-least-32-chars-long-for-security"
_KNOWN_UNSAFE_SECRETS = {
    _DEVELOPMENT_SECRET,
    "change-me-in-production-must-be-32-chars",
    "<generate-a-strong-random-secret-key>",
}


class Settings(BaseSettings):
    """应用配置"""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )
    
    # 基础配置
    ENVIRONMENT: str = Field(default="development")
    DEBUG: bool = Field(default=False)
    VERSION: str = "2.0.0"
    APP_NAME: str = "新能源智库"
    
    @property
    def app_name(self) -> str:
        return self.APP_NAME
    
    @property
    def version(self) -> str:
        return self.VERSION
    
    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT == "development"
    
    @property
    def app_env(self) -> str:
        return self.ENVIRONMENT
    
    @property
    def redis_url(self) -> str:
        return str(self.REDIS_URL)
    
    @property
    def redis_pool_size(self) -> int:
        return 50
    
    @property
    def jwt_access_token_expire_minutes(self) -> int:
        return self.ACCESS_TOKEN_EXPIRE_MINUTES
    
    @property
    def jwt_refresh_token_expire_days(self) -> int:
        return self.REFRESH_TOKEN_EXPIRE_DAYS
    
    @property
    def jwt_algorithm(self) -> str:
        return self.JWT_ALGORITHM
    
    @property
    def jwt_private_key_path(self) -> str:
        return self.JWT_PRIVATE_KEY or ""
    
    @property
    def jwt_public_key_path(self) -> str:
        return self.JWT_PUBLIC_KEY or ""
    
    # 安全配置
    SECRET_KEY: str = Field(
        default=_DEVELOPMENT_SECRET,
        min_length=32,
        description="Secret key - MUST be set via SECRET_KEY env var in production",
    )
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        env_is_set = "SECRET_KEY" in os.environ or "SECRET_KEY" in kwargs
        if self.ENVIRONMENT == "production":
            if not env_is_set or self.SECRET_KEY.strip() in _KNOWN_UNSAFE_SECRETS:
                raise ValueError(
                    "SECURITY ERROR: production requires an explicit, unique SECRET_KEY; "
                    "defaults, placeholders and known example values are rejected."
                )
            if len(set(self.SECRET_KEY)) < 12:
                raise ValueError(
                    "SECURITY ERROR: production SECRET_KEY has insufficient character diversity."
                )
            if str(self.DATABASE_URL).startswith("sqlite"):
                raise ValueError(
                    "SECURITY ERROR: production DATABASE_URL must use a managed database, not SQLite."
                )
            if "localhost" in str(self.REDIS_URL) or "127.0.0.1" in str(self.REDIS_URL):
                raise ValueError(
                    "SECURITY ERROR: production REDIS_URL must reference the deployed Redis service."
                )
            if not self.CORS_ORIGINS or any(
                origin == "*" or not origin.startswith("https://")
                for origin in self.CORS_ORIGINS
            ):
                raise ValueError(
                    "SECURITY ERROR: production CORS_ORIGINS must contain explicit HTTPS origins."
                )
            if self.VECTOR_STORE_BACKEND.lower() in {"sqlite", "memory", "mock"}:
                raise ValueError(
                    "SECURITY ERROR: production VECTOR_STORE_BACKEND must be a durable vector store."
                )
        if not env_is_set:
            warnings.warn(
                "\n"
                "⚠️  WARNING: SECRET_KEY is using the default value. "
                "This is insecure and should only be used for local development. "
                "Set the SECRET_KEY environment variable before deploying.",
                UserWarning,
                stacklevel=2,
            )
    JWT_ALGORITHM: str = "RS256"
    JWT_PRIVATE_KEY: Optional[str] = None
    JWT_PUBLIC_KEY: Optional[str] = None
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # 数据库
    DATABASE_URL: str = Field(
        default="sqlite+aiosqlite:///./energy_dev.db"
    )
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 10
    
    # Redis
    REDIS_URL: str = Field(default="redis://localhost:6379/0")
    
    # CORS
    CORS_ORIGINS: List[str] = Field(default=["http://localhost:3000", "http://localhost:3005"])
    
    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v
    
    # AI配置
    # 国内版
    DASHSCOPE_API_KEY: Optional[str] = None
    DEEPSEEK_API_KEY: Optional[str] = None
    GLM_API_KEY: Optional[str] = None
    
    # 国际版
    ANTHROPIC_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None
    
    # 嵌入模型
    EMBEDDING_PROVIDER: str = "auto"
    EMBEDDING_API_BASE: Optional[str] = None
    EMBEDDING_API_KEY: Optional[str] = None
    EMBEDDING_DIMENSIONS: int = 1024
    ALLOW_MOCK_EMBEDDINGS: bool = False
    EMBEDDING_MODEL: str = "BAAI/bge-m3"  # 国内
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-large"  # 国际
    
    # 向量库
    VECTOR_STORE_BACKEND: str = "sqlite"
    VECTOR_STORE_SQLITE_PATH: str = "data/vector_store.db"
    VECTOR_STORE_DATABASE_URL: Optional[str] = None
    VECTOR_STORE_TABLE: str = "vector_embeddings"
    PINECONE_API_KEY: Optional[str] = None
    PINECONE_ENVIRONMENT: str = "us-west1-gcp"
    MILVUS_HOST: str = "localhost"
    MILVUS_PORT: int = 19530
    
    # 第三方服务
    # 高德地图
    GAODE_MAP_KEY: Optional[str] = None
    # OpenWeatherMap
    OPENWEATHER_API_KEY: Optional[str] = None
    
    # 支付 - Stripe (国际)
    STRIPE_SECRET_KEY: Optional[str] = None
    STRIPE_WEBHOOK_SECRET: Optional[str] = None
    STRIPE_PRO_PRICE_ID: Optional[str] = None
    STRIPE_ENTERPRISE_PRICE_ID: Optional[str] = None

    # 支付 - 支付宝 (国内)
    ALIPAY_APP_ID: Optional[str] = None
    ALIPAY_PRIVATE_KEY: Optional[str] = None
    ALIPAY_PUBLIC_KEY: Optional[str] = None
    ALIPAY_NOTIFY_URL: Optional[str] = None
    ALIPAY_RETURN_URL: Optional[str] = None
    ALIPAY_SANDBOX: bool = True

    # 支付 - 微信支付V3 (国内)
    WECHAT_PAY_MCH_ID: Optional[str] = None
    WECHAT_PAY_APP_ID: Optional[str] = None
    WECHAT_PAY_API_KEY: Optional[str] = None
    WECHAT_PAY_SERIAL_NO: Optional[str] = None
    WECHAT_PAY_PRIVATE_KEY: Optional[str] = None
    WECHAT_PAY_NOTIFY_URL: Optional[str] = None
    WECHAT_PAY_SANDBOX: bool = True

    # 社交登录 - 微信OAuth
    wechat_app_id: Optional[str] = None
    wechat_app_secret: Optional[str] = None
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    GOOGLE_REDIRECT_URI: Optional[str] = None
    APPLE_CLIENT_ID: Optional[str] = None
    APPLE_CLIENT_SECRET: Optional[str] = None
    APPLE_REDIRECT_URI: Optional[str] = None
    GITHUB_CLIENT_ID: Optional[str] = None
    GITHUB_CLIENT_SECRET: Optional[str] = None
    
    # 推送
    JPUSH_APP_KEY: Optional[str] = None
    JPUSH_MASTER_SECRET: Optional[str] = None
    FCM_SERVER_KEY: Optional[str] = None
    
    # 监控
    SENTRY_DSN: Optional[str] = None
    DATADOG_API_KEY: Optional[str] = None
    OTEL_EXPORTER_OTLP_ENDPOINT: Optional[str] = None  # e.g. http://otel-collector:4318
    
    # 限流
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW: int = 60
    
    # 功能开关
    ENABLE_AI_CHAT: bool = True
    ENABLE_REALTIME_SIMULATION: bool = True
    ENABLE_ADVANCED_DIAGNOSTICS: bool = True


@lru_cache()
def get_settings() -> Settings:
    """获取配置单例"""
    return Settings()


settings = get_settings()
