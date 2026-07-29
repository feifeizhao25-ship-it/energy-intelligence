from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, EmailStr

from app.config import settings

SECRET_KEY = settings.SECRET_KEY