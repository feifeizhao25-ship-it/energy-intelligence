import { redirect } from 'next/navigation';

/**
 * 原来的「我的成就」页：统计数据写死为 0、已解锁列表写死为空，没有任何成就能被解锁，
 * 却在每个成就上写着「获得 N 天专业版 / X% 折扣」——奖励既没有发放逻辑，也没有存储。
 * 在成就统计与奖励发放真正接上之前不对外展示，旧链接统一跳回工作台。
 */
export default function AchievementsPage() {
    redirect('/dashboard');
}
