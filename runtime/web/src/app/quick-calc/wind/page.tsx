import { redirect } from 'next/navigation';

// 问答式入口原来不论问的是什么，都按北京坐标调光伏接口，失败时再跳到写死数字的旧结果页
// （「是银行理财的 6 倍」「IRR 15.2%」等）。统一进入需要真实位置与电价的测算页。
export default function WindQuickCalc() {
    redirect('/calculator/wind');
}
