"""统一响应信封助手。"""

from typing import Any, Optional


def success(data: Any = None, message: str = "success", code: int = 0) -> dict:
    return {"code": code, "message": message, "data": data}


def error(message: str, code: int = -1, detail: Optional[Any] = None) -> dict:
    body: dict = {"code": code, "message": message}
    if detail is not None:
        body["detail"] = detail
    return body


def paginated(items: Any, total: int, page: int = 1, page_size: int = 20,
              message: str = "success") -> dict:
    return success(data={
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }, message=message)
