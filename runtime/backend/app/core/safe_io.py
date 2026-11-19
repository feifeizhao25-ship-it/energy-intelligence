"""对外取数和解析 XML 的两道小闸，外加回退目录。

- ``urlopen_http``：只允许 http/https。``urllib`` 默认还能打开 ``file://`` 等协议；
  调用方的地址有的来自配置或清单文件，这里统一拒绝其它协议，失败方式和 urllib
  遇到未知协议时一样（抛 ``urllib.error.URLError``），现有的异常处理不用改。
- ``parse_xml``：用 defusedxml 解析，带 DTD（``<!DOCTYPE``）、实体声明或外部引用的 XML
  一律不解析（由解析器本身拦截，与编码无关），没有实体就没有实体膨胀和外部实体。
  拒绝时抛 ``ElementTree.ParseError`` 的子类，现有 ``except ET.ParseError`` 照常接住。
- ``fallback_dir``：主目录不可写时的回退目录，用 ``tempfile.gettempdir()``，
  部署方可以用 ``TMPDIR`` 指到私有目录，不再写死 ``/tmp``。
"""
from __future__ import annotations

import tempfile
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlsplit
from xml.etree import ElementTree as ET

import defusedxml
from defusedxml import ElementTree as DefusedET

ALLOWED_SCHEMES = frozenset({"http", "https"})


class UnsafeXMLError(ET.ParseError):
    """XML 带 DTD/实体声明或外部引用，按约定不解析。"""


def urlopen_http(request: urllib.request.Request | str, *, timeout: float):
    url = request.full_url if isinstance(request, urllib.request.Request) else str(request)
    scheme = urlsplit(url).scheme.lower()
    if scheme not in ALLOWED_SCHEMES:
        raise urllib.error.URLError(f"unsupported url scheme: {scheme or '(none)'}")
    # 协议已限定为 http/https（上一行）；重定向由 urllib 自带的处理器把关。
    return urllib.request.urlopen(request, timeout=timeout)  # nosec B310


def parse_xml(data: str | bytes) -> ET.Element:
    try:
        return DefusedET.fromstring(data, forbid_dtd=True, forbid_entities=True, forbid_external=True)
    except defusedxml.DefusedXmlException as exc:
        raise UnsafeXMLError("xml_entities_refused") from exc


def fallback_dir() -> Path:
    return Path(tempfile.gettempdir())
