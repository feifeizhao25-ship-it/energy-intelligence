import { NextRequest, NextResponse } from 'next/server';

function isEnglish(req: NextRequest) {
    const requested = req.nextUrl.searchParams.get('locale');
    if (requested) return requested.toLowerCase().startsWith('en');
    const cookie = req.cookies.get('NEXT_LOCALE')?.value;
    if (cookie) return cookie === 'en';
    return req.headers.get('accept-language')?.toLowerCase().startsWith('en') ?? false;
}

export async function GET(req: NextRequest) {
    const en = isEnglish(req);
    const t = en ? {
        title: 'Renewable Energy Intelligence Open API', description: 'Auditable project, literature, and calculation endpoints. Send X-API-Key. Availability depends on key permissions and plan entitlements. Synthetic telemetry and analytics are disabled.', current: 'Current origin',
        projects: 'List projects owned by the API-key user', project: 'Read an accessible project', papers: 'Search Semantic Scholar literature', solar: 'Run an auditable solar-return calculation', monitoring: 'Telemetry is unavailable until a verified SCADA or IoT source is connected', analytics: 'Analytics are unavailable until verified telemetry and benchmark data are connected',
        ok: 'Successful response', unavailable: 'Verified source is not connected', unauthorized: 'Missing or invalid API key', forbidden: 'The key lacks the required permission', limited: 'Rate limit exceeded', notFound: 'Resource not found',
    } : {
        title: '新能源智库开放 API', description: '提供可审计的项目、文献和计算接口。请求须携带 X-API-Key，实际能力取决于密钥权限和会员权益；系统禁止生成虚假遥测与分析数据。', current: '当前站点',
        projects: '分页读取 API Key 所属用户的项目', project: '读取有权访问的单个项目', papers: '通过 Semantic Scholar 检索文献', solar: '执行带审计快照的光伏收益计算', monitoring: '接入经验证的 SCADA 或 IoT 数据前返回不可用', analytics: '接入经验证的遥测与基准数据前返回不可用',
        ok: '请求成功', unavailable: '尚未接入经验证的数据源', unauthorized: 'API Key 缺失或无效', forbidden: '密钥缺少所需权限', limited: '请求频率超限', notFound: '资源不存在',
    };
    const errorResponses = {
        '401': { description: t.unauthorized, content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        '403': { description: t.forbidden, content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        '429': { description: t.limited, content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
    };
    const idParameter = { name: 'id', in: 'path', required: true, schema: { type: 'string' } };
    const spec = {
        openapi: '3.0.3', info: { title: t.title, description: t.description, version: '1.0.0' }, servers: [{ url: '/api/v1', description: t.current }], security: [{ ApiKeyAuth: [] }],
        paths: {
            '/projects': { get: { summary: t.projects, operationId: 'listProjects', parameters: [{ name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } }, { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } }, { name: 'type', in: 'query', schema: { type: 'string' } }], responses: { '200': { description: t.ok }, ...errorResponses } } },
            '/projects/{id}': { get: { summary: t.project, operationId: 'getProject', parameters: [idParameter], responses: { '200': { description: t.ok }, '404': { description: t.notFound }, ...errorResponses } } },
            '/projects/{id}/monitoring': { get: { summary: t.monitoring, operationId: 'getMonitoring', parameters: [idParameter], responses: { '503': { description: t.unavailable }, ...errorResponses } } },
            '/projects/{id}/analytics': { get: { summary: t.analytics, operationId: 'getAnalytics', parameters: [idParameter], responses: { '503': { description: t.unavailable }, ...errorResponses } } },
            '/papers/search': { get: { summary: t.papers, operationId: 'searchPapers', parameters: [{ name: 'q', in: 'query', required: true, schema: { type: 'string' } }, { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } }, { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } }, { name: 'year', in: 'query', schema: { type: 'integer' } }], responses: { '200': { description: t.ok }, '503': { description: t.unavailable }, ...errorResponses } } },
            '/calculate/solar': { post: { summary: t.solar, operationId: 'calculateSolar', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } }, responses: { '200': { description: t.ok }, ...errorResponses } } },
        },
        components: { securitySchemes: { ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-API-Key' } }, schemas: { ErrorResponse: { type: 'object', required: ['success', 'error'], properties: { success: { type: 'boolean', enum: [false] }, error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' } } } } } } },
    };
    return NextResponse.json(spec, { headers: { 'Cache-Control': 'public, max-age=300', 'Content-Language': en ? 'en' : 'zh-CN', Vary: 'Cookie, Accept-Language' } });
}
