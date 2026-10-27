"""企业微信回调入口。GET 回显 echostr，POST 处理审批事件。"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import PlainTextResponse

from app.services.wecom_callback import receive_event, verify_echo

router = APIRouter()


@router.get("/wecom/callback")
async def wecom_verify(request: Request):
    query = request.query_params
    try:
        plain = verify_echo(
            query.get("timestamp", ""),
            query.get("nonce", ""),
            query.get("echostr", ""),
            query.get("msg_signature", ""),
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail="回调未配置") from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail="签名校验未通过") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="回调报文无效") from exc
    return PlainTextResponse(plain)


@router.post("/wecom/callback")
async def wecom_event(request: Request):
    query = request.query_params
    raw = await request.body()
    try:
        result = receive_event(raw, query.get("timestamp", ""), query.get("nonce", ""), query.get("msg_signature", ""))
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail="回调未配置") from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail="签名校验未通过") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="回调报文无效") from exc
    return PlainTextResponse(result.get("ack") or "success")
