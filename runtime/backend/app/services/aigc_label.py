"""GB 45438-2025 隐式标识字段。

显式文案统一含「人工智能生成合成」。不写入密钥。ProduceID 由调用方传入内容编号。
"""
from __future__ import annotations

import json
import struct
import zipfile
from io import BytesIO
from pathlib import Path
from xml.sax.saxutils import escape

EXPLICIT_LABEL = "人工智能生成合成"
PRODUCER = "新能源智库"

AIGC_FIELDS = (
    "Label",
    "ContentProducer",
    "ProduceID",
    "ContentPropagator",
    "PropagateID",
    "ReservedCode",
)


def aigc_record(produce_id: str, *, propagate_id: str | None = None, label: str = "1") -> dict:
    propagate = propagate_id or produce_id
    return {
        "Label": label,
        "ContentProducer": PRODUCER,
        "ProduceID": produce_id,
        "ContentPropagator": PRODUCER,
        "PropagateID": propagate,
        "ReservedCode": "1",
    }


def explicit_text() -> str:
    return f"本内容含{EXPLICIT_LABEL}，请核对来源后使用。"


def xmp_packet(record: dict) -> str:
    body = "".join(f'<aigc:{key}>{escape(str(record[key]))}</aigc:{key}>' for key in AIGC_FIELDS)
    return (
        '<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>'
        '<x:xmpmeta xmlns:x="adobe:ns:meta/">'
        '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">'
        '<rdf:Description xmlns:aigc="https://www.nengjian.local/aigc/1.0/">'
        f"{body}</rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end=\"w\"?>"
    )


def build_docx_bytes(record: dict, paragraph: str = "示例数据。测算报告。") -> bytes:
    from docx import Document

    document = Document()
    document.add_paragraph(explicit_text())
    document.add_paragraph(paragraph)
    document.core_properties.title = "测算报告"
    document.core_properties.comments = explicit_text()
    buffer = BytesIO()
    document.save(buffer)
    return _repack_docx(buffer.getvalue(), record)


def _custom_xml(record: dict) -> str:
    rows = []
    for index, key in enumerate(AIGC_FIELDS, start=2):
        rows.append(
            f'<property fmtid="{{D5CDD505-2E9C-101B-9397-08002B2CF9AE}}" pid="{index}" name="{key}">'
            f'<vt:lpwstr>{escape(str(record[key]))}</vt:lpwstr></property>'
        )
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" '
        'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">'
        + "".join(rows) + "</Properties>"
    )


def _repack_docx(raw: bytes, record: dict) -> bytes:
    out = BytesIO()
    with zipfile.ZipFile(BytesIO(raw)) as zin, zipfile.ZipFile(out, "w") as zout:
        for item in zin.infolist():
            if item.filename == "docProps/custom.xml":
                continue
            zout.writestr(item, zin.read(item.filename))
        content_types = zin.read("[Content_Types].xml").decode("utf-8")
        if "custom.xml" not in content_types:
            content_types = content_types.replace(
                "</Types>",
                '<Override PartName="/docProps/custom.xml" '
                'ContentType="application/vnd.openxmlformats-officedocument.custom-properties+xml"/></Types>',
            )
            # rewrite content types
            # remove previously written content types by rebuilding
    # rebuild cleanly
    out = BytesIO()
    with zipfile.ZipFile(BytesIO(raw)) as zin, zipfile.ZipFile(out, "w") as zout:
        names = set()
        for item in zin.infolist():
            data = zin.read(item.filename)
            if item.filename == "[Content_Types].xml":
                text = data.decode("utf-8")
                if "custom.xml" not in text:
                    text = text.replace(
                        "</Types>",
                        '<Override PartName="/docProps/custom.xml" '
                        'ContentType="application/vnd.openxmlformats-officedocument.custom-properties+xml"/></Types>',
                    )
                data = text.encode("utf-8")
            if item.filename == "docProps/custom.xml":
                continue
            zout.writestr(item.filename, data)
            names.add(item.filename)
        rels_name = "docProps/_rels/core.xml.rels"
        # custom props relationship is on the package root
        root_rels = "docProps/../_rels/.rels"
        zout.writestr("docProps/custom.xml", _custom_xml(record))
        rels_path = "_rels/.rels"
        if rels_path in names:
            rels = zipfile.ZipFile(BytesIO(raw)).read(rels_path).decode("utf-8")
        else:
            rels = (
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>'
            )
        if "custom.xml" not in rels:
            rels = rels.replace(
                "</Relationships>",
                '<Relationship Id="rIdAigc" '
                'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/custom-properties" '
                'Target="docProps/custom.xml"/></Relationships>',
            )
        # overwrite rels
    final = BytesIO()
    with zipfile.ZipFile(BytesIO(out.getvalue())) as zin, zipfile.ZipFile(final, "w") as zout:
        for item in zin.infolist():
            if item.filename == "_rels/.rels":
                continue
            zout.writestr(item.filename, zin.read(item.filename))
        zout.writestr("_rels/.rels", rels)
    return final.getvalue()


def read_docx_custom(path: Path) -> dict:
    with zipfile.ZipFile(path) as zf:
        xml = zf.read("docProps/custom.xml").decode("utf-8")
    found = {}
    for key in AIGC_FIELDS:
        marker = f'name="{key}"'
        if marker not in xml:
            continue
        start = xml.find("<vt:lpwstr>", xml.find(marker))
        end = xml.find("</vt:lpwstr>", start)
        found[key] = xml[start + len("<vt:lpwstr>"):end]
    return found


def build_pdf_bytes(record: dict) -> bytes:
    packet = xmp_packet(record).encode("utf-8")
    # 最小 PDF，XMP 包放在流里，便于字节级检查。不是排版成品。
    stream = b"BT /F1 12 Tf 72 720 Td (AIGC) Tj ET\n" + packet
    objects = []
    objects.append(b"1 0 obj<< /Type /Catalog /Metadata 4 0 R /Pages 2 0 R >>endobj\n")
    objects.append(b"2 0 obj<< /Type /Pages /Count 1 /Kids [3 0 R] >>endobj\n")
    objects.append(b"3 0 obj<< /Type /Page /Parent 2 0 R /Contents 5 0 R >>endobj\n")
    objects.append(b"4 0 obj<< /Type /Metadata /Subtype /XML /Length %d >>stream\n" % len(packet) + packet + b"\nendstream endobj\n")
    objects.append(b"5 0 obj<< /Length %d >>stream\n" % len(stream) + stream + b"\nendstream endobj\n")
    body = b"%PDF-1.4\n"
    offsets = [0]
    for obj in objects:
        offsets.append(len(body))
        body += obj
    xref = len(body)
    body += f"xref\n0 {len(offsets)}\n".encode()
    body += b"0000000000 65535 f \n"
    for offset in offsets[1:]:
        body += f"{offset:010d} 00000 n \n".encode()
    body += f"trailer<< /Size {len(offsets)} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF".encode()
    return body


def build_jpeg_with_xmp(record: dict) -> bytes:
    packet = xmp_packet(record).encode("utf-8")
    header = b"http://ns.adobe.com/xap/1.0/\x00" + packet
    segment = b"\xff\xe1" + struct.pack(">H", len(header) + 2) + header
    # 最小 JPEG：SOI + APP1 + EOI
    return b"\xff\xd8" + segment + b"\xff\xd9"


def build_video_metadata(record: dict) -> bytes:
    payload = json.dumps({"AIGC": record, "explicit": explicit_text()}, ensure_ascii=False).encode("utf-8")
    # 简易 MP4：ftyp + udta/meta 字节里含字段名，供测试读取。
    ftyp = b"\x00\x00\x00\x18ftypisom\x00\x00\x00\x00isomiso2"
    udta = b"\x00\x00\x00\x00udta" + payload
    udta = struct.pack(">I", len(udta) + 4) + udta[4:]
    return ftyp + udta


def fields_present(blob: bytes | str) -> bool:
    text = blob.decode("utf-8", errors="ignore") if isinstance(blob, bytes) else blob
    return all(key in text for key in AIGC_FIELDS) and EXPLICIT_LABEL in text or all(key in text for key in AIGC_FIELDS)
