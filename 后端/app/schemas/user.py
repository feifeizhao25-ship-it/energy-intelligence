from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime


class UserResponse(BaseModel):
    id: str
    name: str
    email: EmailStr
    company: Optional[str] = None
    role: Optional[str] = None
    country: Optional[str] = None
    plan: str
    created_at: datetime

    class Config:
        from_attributes = True


class UserUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    company: Optional[str] = None
    role: Optional[str] = None
    country: Optional[str] = None
