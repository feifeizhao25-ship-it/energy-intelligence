import { crc32 } from 'zlib';

function dosTime(date = new Date()) {
    const time = ((date.getHours() & 31) << 11) | ((date.getMinutes() & 63) << 5) | ((date.getSeconds() / 2) & 31);
    const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
    return { time, day };
}

/** STORE 方式的 ZIP，避免再引入压缩库。 */
export function zipStore(files: { name: string; data: string | Buffer }[]): Buffer {
    const locals: Buffer[] = [];
    const centrals: Buffer[] = [];
    let offset = 0;
    const stamp = dosTime();
    for (const file of files) {
        const name = Buffer.from(file.name);
        const data = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data);
        const crc = crc32(data) >>> 0;
        const local = Buffer.alloc(30 + name.length);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(0, 8);
        local.writeUInt16LE(stamp.time, 10);
        local.writeUInt16LE(stamp.day, 12);
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(data.length, 18);
        local.writeUInt32LE(data.length, 22);
        local.writeUInt16LE(name.length, 26);
        name.copy(local, 30);
        locals.push(local, data);
        const central = Buffer.alloc(46 + name.length);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(20, 4);
        central.writeUInt16LE(20, 6);
        central.writeUInt16LE(stamp.time, 12);
        central.writeUInt16LE(stamp.day, 14);
        central.writeUInt32LE(crc, 16);
        central.writeUInt32LE(data.length, 20);
        central.writeUInt32LE(data.length, 24);
        central.writeUInt16LE(name.length, 28);
        central.writeUInt32LE(offset, 42);
        name.copy(central, 46);
        centrals.push(central);
        offset += local.length + data.length;
    }
    const centralDir = Buffer.concat(centrals);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(files.length, 8);
    end.writeUInt16LE(files.length, 10);
    end.writeUInt32LE(centralDir.length, 12);
    end.writeUInt32LE(offset, 16);
    return Buffer.concat([...locals, centralDir, end]);
}

function cell(ref: string, text: string) {
    const safe = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<c r="${ref}" t="inlineStr"><is><t>${safe}</t></is></c>`;
}

export function workbookBuffer(rows: string[][]): Buffer {
    const sheetRows = rows.map((row, index) => {
        const cells = row.map((value, column) => cell(String.fromCharCode(65 + column) + (index + 1), value)).join('');
        return `<row r="${index + 1}">${cells}</row>`;
    }).join('');
    const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`;
    return zipStore([
        { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>` },
        { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
        { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="新能源智库" sheetId="1" r:id="rId1"/></sheets></workbook>` },
        { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>` },
        { name: 'xl/worksheets/sheet1.xml', data: sheet },
    ]);
}

function xmlText(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const URL_LINE = /^https?:\/\/\S+$/;
const DATE_TOKEN = /20\d{2}年\d{1,2}月\d{1,2}日|20\d{2}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}:\d{2})?/g;
/** A4 正文宽度大约能排 40 个汉字。短于这个长度的段落不会在日期中间换行。 */
const CLAUSE_LIMIT = 28;

/** 只在会超过一行时按已有标点拆段。日期始终留在同一段，不增删字符。 */
export function layoutClauses(text: string): string[] {
    if (URL_LINE.test(text) || Array.from(text).length <= CLAUSE_LIMIT) return [text];
    const atoms: string[] = [];
    let buf = '';
    for (const ch of Array.from(text)) {
        buf += ch;
        if (/[。；，]/.test(ch)) {
            atoms.push(buf);
            buf = '';
        }
    }
    if (buf) atoms.push(buf);
    const bits: string[] = [];
    for (const atom of atoms) {
        let rest = atom;
        while (Array.from(rest).length > CLAUSE_LIMIT) {
            const match = new RegExp(DATE_TOKEN.source).exec(rest);
            if (match && match.index > 0) {
                bits.push(rest.slice(0, match.index));
                rest = rest.slice(match.index);
                continue;
            }
            if (match && match.index === 0) {
                bits.push(rest.slice(0, match[0].length));
                rest = rest.slice(match[0].length);
                continue;
            }
            bits.push(rest);
            rest = '';
            break;
        }
        if (rest) bits.push(rest);
    }
    const out: string[] = [];
    let current = '';
    for (const bit of bits) {
        if (current && Array.from(current + bit).length > CLAUSE_LIMIT) {
            out.push(current);
            current = bit;
        } else {
            current += bit;
        }
    }
    if (current) out.push(current);
    return out;
}

function runXml(text: string, ascii: string, eastAsia: string, size?: string, link = false): string {
    const color = link ? '<w:color w:val="0563C1"/><w:u w:val="single"/>' : '';
    const sz = size ? `<w:sz w:val="${size}"/>` : '';
    return `<w:r><w:rPr><w:rFonts w:ascii="${ascii}" w:hAnsi="${ascii}" w:eastAsia="${eastAsia}"/>${sz}${color}</w:rPr><w:t xml:space="preserve">${xmlText(text)}</w:t></w:r>`;
}

function paragraphXml(text: string, ascii: string, eastAsia: string, size?: string, linkId?: string, keepNext = false): string {
    const run = runXml(text, ascii, eastAsia, size, Boolean(linkId));
    const inner = linkId ? `<w:hyperlink r:id="${linkId}" w:history="1">${run}</w:hyperlink>` : run;
    const keep = keepNext ? '<w:keepNext/>' : '';
    return `<w:p><w:pPr><w:keepLines/>${keep}<w:autoSpaceDE w:val="0"/><w:autoSpaceDN w:val="0"/></w:pPr>${inner}</w:p>`;
}

function sourceTable(paragraphs: string): string {
    return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="9638"/></w:tblGrid><w:tr><w:trPr><w:cantSplit/></w:trPr><w:tc><w:tcPr><w:tcW w:w="9638" w:type="dxa"/></w:tcPr>${paragraphs}</w:tc></w:tr></w:tbl>`;
}

function lineParagraphs(text: string, links: { id: string; url: string }[], keepNext: boolean): string {
    if (URL_LINE.test(text)) {
        const id = `rIdLink${links.length + 1}`;
        links.push({ id, url: text });
        return paragraphXml(text, 'FangSong', '仿宋', undefined, id, keepNext);
    }
    return layoutClauses(text).map((clause, index, all) => paragraphXml(clause, 'FangSong', '仿宋', undefined, undefined, keepNext || index < all.length - 1)).join('');
}

/** 公文版资料汇编。封面写非正式文件，标题黑体、正文仿宋，不用红头。整行 URL 写成可点击超链接。以 [n] 开头的来源整段放进不可跨页的表格行。 */
export function gazetteBuffer(title: string, rows: string[][]): Buffer {
    const links: { id: string; url: string }[] = [];
    const lines = rows.map((row) => row.join(' '));
    const firstSource = lines.findIndex((line) => /^\[\d+\] /.test(line));
    let epilogueAt = -1;
    for (let index = lines.length - 1; index >= 0; index -= 1) {
        if (lines[index].startsWith('本文件由软件')) { epilogueAt = index; break; }
    }
    const preambleEnd = firstSource === -1 ? lines.length : firstSource;
    const sourceEnd = epilogueAt > preambleEnd ? epilogueAt : lines.length;
    const blocks: string[] = [];
    for (const line of lines.slice(0, preambleEnd)) blocks.push(lineParagraphs(line, links, false));
    let cursor = preambleEnd;
    while (cursor < sourceEnd) {
        const next = lines.findIndex((line, index) => index > cursor && /^\[\d+\] /.test(line));
        const end = next === -1 || next > sourceEnd ? sourceEnd : next;
        const group = lines.slice(cursor, end);
        const paragraphs = group.map((line, index) => lineParagraphs(line, links, index < group.length - 1)).join('');
        blocks.push(sourceTable(paragraphs));
        cursor = end;
    }
    for (const line of lines.slice(sourceEnd)) blocks.push(lineParagraphs(line, links, false));
    const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${paragraphXml('资料汇编 · 非正式文件', 'SimHei', '黑体', '32')}
    ${paragraphXml(title, 'SimHei', '黑体')}
    ${blocks.join('')}
    ${paragraphXml('本文件不是行政机关公文，测算值不是承诺。公文模板待企业微信审批，未签字。', 'FangSong', '仿宋')}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;
    const relationships = links.map((link) => `<Relationship Id="${link.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${xmlText(link.url)}" TargetMode="External"/>`).join('');
    return zipStore([
        { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>` },
        { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>` },
        { name: 'word/_rels/document.xml.rels', data: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships}</Relationships>` },
        { name: 'word/document.xml', data: document },
    ]);
}

export function slidesBuffer(title: string, lines: string[]): Buffer {
    const text = [title, ...lines].map((line) => `<a:p><a:r><a:rPr lang="zh-CN" dirty="0"/><a:t>${line.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</a:t></a:r></a:p>`).join('');
    const slide = `<?xml version="1.0" encoding="UTF-8"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/><p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>${text}</p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;
    return zipStore([
        { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>` },
        { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>` },
        { name: 'ppt/presentation.xml', data: `<?xml version="1.0" encoding="UTF-8"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst></p:presentation>` },
        { name: 'ppt/_rels/presentation.xml.rels', data: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/></Relationships>` },
        { name: 'ppt/slides/slide1.xml', data: slide },
    ]);
}
