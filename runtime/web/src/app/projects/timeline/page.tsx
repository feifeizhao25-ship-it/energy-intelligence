/** 项目时间线。没有接入项目事件时只说明未连接，不展示编造的电量和收益。 */
export default function ProjectTimelinePage() {
    return (
        <main className="mx-auto max-w-3xl px-6 py-10">
            <h1 className="text-2xl font-bold text-slate-900">项目时间线</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
                时间线尚未连接。这里不展示示例项目、发电量、收益或性能比。保存测算并写入项目事件后，才会按记录列出。
            </p>
        </main>
    );
}
