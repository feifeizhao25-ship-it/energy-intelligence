"""app.core.safe_io：只开 http/https、不解析带实体声明的 XML、回退目录跟随 TMPDIR。"""
import tempfile
import urllib.error
import urllib.request
from pathlib import Path
from xml.etree import ElementTree as ET

import pytest

from app.core import safe_io


@pytest.mark.parametrize("url", ["file:///etc/passwd", "ftp://example.com/x", "data:text/plain,hi", "/relative/path"])
def test_urlopen_http_refuses_other_schemes(monkeypatch, url):
    called = []
    monkeypatch.setattr(urllib.request, "urlopen", lambda *a, **k: called.append(a))
    with pytest.raises(urllib.error.URLError):
        safe_io.urlopen_http(url, timeout=1)
    with pytest.raises(urllib.error.URLError):
        safe_io.urlopen_http(urllib.request.Request(url) if "://" in url else url, timeout=1)
    assert called == []


@pytest.mark.parametrize("url", ["https://api.example.com/x", "HTTP://example.com/"])
def test_urlopen_http_passes_http_and_https_through(monkeypatch, url):
    seen = []
    monkeypatch.setattr(urllib.request, "urlopen", lambda req, timeout: seen.append((req, timeout)) or "resp")
    req = urllib.request.Request(url)
    assert safe_io.urlopen_http(req, timeout=7) == "resp"
    assert seen == [(req, 7)]


def test_parse_xml_parses_plain_documents():
    root = safe_io.parse_xml(b"<feed><entry><title>t</title></entry></feed>")
    assert root.find("entry/title").text == "t"
    assert safe_io.parse_xml("<a>中文</a>").text == "中文"


@pytest.mark.parametrize("doc", [
    b'<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol">]><lolz>&lol;</lolz>',
    b'<!doctype a><a/>',
    '<!ENTITY x "y"><a/>',
    "<a/>".encode("utf-16"),
])
def test_parse_xml_refuses_entities_and_wide_encodings(doc):
    with pytest.raises(ET.ParseError):
        safe_io.parse_xml(doc)


def test_fallback_dir_follows_tempfile(monkeypatch, tmp_path):
    monkeypatch.setattr(tempfile, "tempdir", str(tmp_path))
    assert safe_io.fallback_dir() == Path(tmp_path)
