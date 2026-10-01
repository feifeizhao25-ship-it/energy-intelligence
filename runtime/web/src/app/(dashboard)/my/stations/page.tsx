import { redirect } from 'next/navigation';

/**
 * 原来这里是一个只有界面的「我的电站」：电站列表永远为空，「保存电站」按钮没有任何动作，
 * 录入的发电数据只改本地状态、刷新即丢，还会把没填的收益按 0.85 元/度编出来。
 * 电站的真实管理在项目里（项目详情 -> 电站），这里统一跳到项目列表，旧链接（推送、首页入口）不会 404。
 */
export default function MyStationsPage() {
    redirect('/projects');
}
