import { redirect } from 'next/navigation';

// 统一进入需要真实位置、成本和电价的光伏估算，避免问答入口代入北京。
export default function SolarQuickCalc() {
    redirect('/calculator/solar');
}
