from pydantic import BaseModel, Field, model_validator
class EmailLoginRequest(BaseModel):
    email: Optional[str] = Field(default=None, min_length=5, max_length=200)
    password: Optional[str] = Field(default=None, min_length=1, max_length=100)
    phone: Optional[str] = Field(default=None, pattern=r"^1[3-9]\d{9}$")
    sms_code: Optional[str] = Field(default=None, min_length=4, max_length=6)

    @model_validator(mode="after")
    def require_supported_login_mode(self):
        has_email_login = bool(self.email and self.password)
        has_phone_login = bool(self.phone and self.sms_code)
        if not has_email_login and not has_phone_login:
            raise ValueError("Provide email/password or phone/sms_code")
        return self
    result = await db.execute(select(User).where(User.email == body.email))
