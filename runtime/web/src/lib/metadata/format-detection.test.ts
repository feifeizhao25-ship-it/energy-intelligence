import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cnFormatDetection, formatDetectionContent } from './format-detection';

describe('国内布局关闭 iOS 自动识别', () => {
    it('formatDetection 写成 telephone、date、address、email 均为 no', () => {
        expect(formatDetectionContent(cnFormatDetection)).toBe('telephone=no, date=no, address=no, email=no');
        expect(formatDetectionContent(cnFormatDetection)).not.toContain('url=');
        const layout = readFileSync(join(__dirname, '../../app/layout.tsx'), 'utf8');
        expect(layout).toContain("from '@/lib/metadata/format-detection'");
        expect(layout).toContain('formatDetection: cnFormatDetection');
    });
});
