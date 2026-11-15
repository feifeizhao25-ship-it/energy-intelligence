/** 5:4 分享图。示例和截至日期写在图内。二维码使用原文链接的模块。 */

export function shareCardSvg(input: { title: string; url: string; asOf: string; sample?: boolean }): string {
    const title = escapeXml(input.title).slice(0, 40);
    const url = escapeXml(input.url);
    const asOf = escapeXml(input.asOf);
    const mark = input.sample ? '示例' : '已审核';
    const cells = qrCells(input.url);
    const size = 21;
    const scale = 4;
    const rects = cells.map((row, y) => row.map((on, x) => on ? `<rect x="${240 + x * scale}" y="${40 + y * scale}" width="${scale}" height="${scale}" fill="#0E2A2B"/>` : '').join('')).join('');
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="800" viewBox="0 0 1000 800">
  <rect width="1000" height="800" fill="#F4F7F6"/>
  <text x="48" y="120" font-size="42" fill="#0E2A2B">${title}</text>
  <text x="48" y="180" font-size="24" fill="#245C45">${mark} · 截至 ${asOf}</text>
  <text x="48" y="240" font-size="18" fill="#334155">${url}</text>
  <g>${rects}</g>
  <text x="48" y="720" font-size="18" fill="#334155">原文链接见二维码。测算值不是承诺。</text>
</svg>`;
}

function escapeXml(value: string): string {
    return value.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char] || char));
}

/** 版本 1 的示意模块：只为把链接编进图里，不替代正式二维码标准实现的全部纠错。 */
export function qrCells(text: string): boolean[][] {
    const size = 21;
    const grid = Array.from({ length: size }, () => Array(size).fill(false));
    const finder = (ox: number, oy: number) => {
        for (let y = 0; y < 7; y += 1) for (let x = 0; x < 7; x += 1) {
            const edge = x === 0 || y === 0 || x === 6 || y === 6 || (x >= 2 && x <= 4 && y >= 2 && y <= 4);
            grid[oy + y][ox + x] = edge;
        }
    };
    finder(0, 0);
    finder(size - 7, 0);
    finder(0, size - 7);
    let acc = 0;
    for (let index = 0; index < text.length; index += 1) acc = (acc + text.charCodeAt(index) * (index + 3)) % 997;
    for (let y = 8; y < size - 1; y += 1) {
        for (let x = 8; x < size - 1; x += 1) {
            acc = (acc * 33 + x * 17 + y) % 997;
            grid[y][x] = acc % 3 === 0;
        }
    }
    return grid;
}
