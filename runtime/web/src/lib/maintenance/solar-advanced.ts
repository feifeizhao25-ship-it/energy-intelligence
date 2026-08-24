
import { ELDetectInput, ELDetectResult } from './types-advanced';

export async function detectELDefects(input: ELDetectInput): Promise<ELDetectResult> {
    void input;
    throw new Error('EL 缺陷识别服务尚未接入经验证的生产模型，未生成任何诊断结果');
}
