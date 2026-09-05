import { NextRequest } from 'next/server';
import { POST } from './route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { simpleChat } from '@/lib/ai/unified';
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
jest.mock('@/lib/auth/auth-options', () => ({ authOptions: {} }));
jest.mock('@/lib/prisma', () => ({ prisma: { project: { findFirst: jest.fn() } } }));
jest.mock('@/lib/ai/unified', () => ({ simpleChat: jest.fn() }));
const request = () => new NextRequest('http://localhost/api/projects/diagnosis', { method: 'POST', body: JSON.stringify({ projectId: 'p1' }) });
beforeEach(() => {
 jest.resetAllMocks();
 jest.mocked(getServerSession).mockResolvedValue({ user: { id: 'u1' } } as any);
});
it('未登录不访问项目或模型', async () => {
 jest.mocked(getServerSession).mockResolvedValue(null);
 const response = await POST(request());
 expect(response.status).toBe(401);
 expect((await response.json()).error).toBe('请先登录');
 expect(prisma.project.findFirst).not.toHaveBeenCalled();
});
it('没有运行数据不生成诊断', async () => {
 jest.mocked(prisma.project.findFirst).mockResolvedValue({ dailyAnalyses: [] } as any);
 expect((await POST(request())).status).toBe(422);
 expect(simpleChat).not.toHaveBeenCalled();
});
it('不展示模型臆测评分或维护日期，不把缺失值当作零', async () => {
 jest.mocked(prisma.project.findFirst).mockResolvedValue({ id: 'p1', dailyAnalyses: [{ analysisDate: new Date('2026-09-05'), generationActual: null, generationExpected: null, pr: null, healthScore: null, faultCount: 0 }] } as any);
 jest.mocked(simpleChat).mockResolvedValue(JSON.stringify({ summary: '证据不足', status: 'healthy', scores: { overall: 99, efficiency: 99, maintenance: 99, safety: 99 }, nextMaintenanceDate: '2026-09-20', issues: [], recommendations: [] }));
 const response = await POST(request());
 expect(response.status).toBe(200);
 const body = await response.json();
 expect(body.data.status).toBe('unknown');
 expect(Object.values(body.data.scores)).toEqual([null, null, null, null]);
 expect(body.data.nextMaintenanceDate).toBeNull();
 expect(jest.mocked(simpleChat).mock.calls[0][0]).toContain('"actualGeneration":null');
 expect(prisma.project.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'p1', userId: 'u1' } }));
});
it('拒绝无法渲染的建议结构', async () => {
 jest.mocked(prisma.project.findFirst).mockResolvedValue({ dailyAnalyses: [{ analysisDate: new Date(), faultCount: 1 }] } as any);
 jest.mocked(simpleChat).mockResolvedValue(JSON.stringify({ summary: '检查', issues: [null], recommendations: [{}] }));
 const response = await POST(request());
 expect(response.status).toBe(503);
 expect((await response.json()).error).toBe('诊断服务暂时不可用，请稍后重试');
});
