from pydantic import BaseModel, EmailStr, Field, model_validator
from typing import List, Literal, Optional


class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8)
    company: Optional[str] = None
    role: Optional[str] = None
    country: Optional[str] = None
    market: Literal["cn", "global"] = "cn"
    data_transfer_consent: bool = False
    # 国内版注册来源题（可跳过）：只认九个枚举代码，其余在服务端丢掉；不进账号表
    signup_source: Optional[str] = Field(None, max_length=32)
    tech_focus: Optional[List[str]] = None

    @model_validator(mode="after")
    def require_global_data_transfer_consent(self):
        if self.market == "global" and not self.data_transfer_consent:
            raise ValueError("global registration requires explicit data transfer consent")
        return self


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = 900  # 15 min


class MagicLinkRequest(BaseModel):
    email: EmailStr


class MagicLinkVerifyRequest(BaseModel):
    token: str
