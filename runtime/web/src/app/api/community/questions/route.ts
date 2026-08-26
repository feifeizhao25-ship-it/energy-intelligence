import { NextResponse } from 'next/server';

const unavailable = () => NextResponse.json(
    {
        error: '社区服务尚未接入持久化数据库，未返回或保存任何模拟内容',
        code: 'COMMUNITY_STORAGE_UNAVAILABLE',
    },
    { status: 503 },
);

// 社区内容必须来自可审计的持久化存储。数据库接入前统一失败关闭，
// 避免把进程内样例、重启即丢失的问题或虚构专家回答展示给生产用户。
export async function GET() {
    return unavailable();
}

export async function POST() {
    return unavailable();
}
