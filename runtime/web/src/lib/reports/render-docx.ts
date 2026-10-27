import { formatGbt7714 } from '@/lib/citation/gbt7714';
import { gazetteBuffer } from '@/lib/reports/ooxml-zip';
import type { ReportSpec } from '@/lib/reports/report-builders';

export function renderReportDocx(spec: ReportSpec): Buffer {
    const references = spec.references.map((item) => formatGbt7714({
        authors: item.source,
        title: item.title,
        source: item.source,
        year: item.year,
    }));
    const rows = [
        [spec.meta.title],
        [`用户 ${spec.meta.user}`, `日期 ${spec.meta.date}`, `版本 ${spec.meta.version}`],
        ['目录（打开后更新域）'],
        ...spec.sections.flatMap((section) => [
            [`${section.heading}`],
            ...section.blocks.map((block) => [block.text || '']),
        ]),
        ['式 1 见公式编号'],
        ...references.map((line) => [line]),
        [spec.aigc.label],
        ...spec.disclaimers.map((line) => [line]),
        [`水印 ${spec.meta.watermark}`],
    ];
    return gazetteBuffer(spec.meta.title, rows);
}
