
import { ELDetectInput, ELDetectResult } from './types-advanced';

export async function detectELDefects(input: ELDetectInput): Promise<ELDetectResult> {
    // Mock processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    const defectCount = Math.floor(Math.random() * 5); // 0-4 defects
    const severity = defectCount > 2 ? 'high' : defectCount > 0 ? 'medium' : 'low';
    const status = defectCount > 0 ? (defectCount > 2 ? 'fail' : 'review') : 'pass';

    const defects = [];
    if (defectCount > 0) {
        if (Math.random() > 0.5) {
            defects.push({
                type: 'crack',
                confidence: 0.95,
                location: 'Module 3, Cell 5',
                area: '15mm x 2mm',
                severity: 'medium' as const,
                description: '隐裂，可能由运输或安装应力造成'
            });
        }
        if (Math.random() > 0.5) {
            defects.push({
                type: 'black_core',
                confidence: 0.88,
                location: 'Module 3, Cell 8',
                area: 'Entire Cell',
                severity: 'high' as const,
                description: '黑心片，材料质量问题'
            });
        }
    }

    return {
        summary: {
            defectCount: defects.length,
            severity,
            status
        },
        defects,
        recommendations: defects.length > 0
            ? ['建议对隐裂组件进行红外复测', '标记并持续监控黑心片区域']
            : ['组件状况良好，无需特殊处理'],
        originalImage: input.imageUrl || '/mock-el-original.jpg',
        processedImage: input.imageUrl || '/mock-el-processed.jpg'
    };
}
