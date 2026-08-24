import { VibrationInput, VibrationResult, BladeDroneInput, BladeDroneResult } from './types-advanced';

export async function analyzeVibration(input: VibrationInput): Promise<VibrationResult> {
    void input;
    throw new Error('振动分析服务尚未接入经验证的生产算法，未生成任何诊断结果');
}

export async function analyzeBladeImage(input: BladeDroneInput): Promise<BladeDroneResult> {
    void input;
    throw new Error('叶片图像分析服务尚未接入经验证的生产模型，未生成任何诊断结果');
}
