"""The served OpenAPI document is English. Chinese notes stay in the source, not in description fields."""
from __future__ import annotations

import re
from typing import Any

CJK = re.compile(r"[\u3400-\u9fff]")
ENGLISH_NOTE = "Described in the product source. This field is not given in Chinese here."


def strip_cjk_descriptions(node: Any) -> None:
    if isinstance(node, dict):
        for key in ("description", "summary", "title"):
            value = node.get(key)
            if isinstance(value, str) and CJK.search(value):
                node[key] = ENGLISH_NOTE
        for value in node.values():
            strip_cjk_descriptions(value)
    elif isinstance(node, list):
        for item in node:
            strip_cjk_descriptions(item)
