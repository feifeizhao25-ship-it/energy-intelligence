import { NextRequest, NextResponse } from 'next/server';

/**
 * 开放 API 文档
 * 
 * GET /api/v1/docs
 * 
 * 返回完整的 API 文档（OpenAPI 3.0 格式）
 */

const openApiSpec = {
    openapi: '3.0.3',
    info: {
        title: '新能源智库 开放 API',
        description: `
# 新能源智库 Open API

欢迎使用新能源智库开放API！本API提供新能源项目数据、监控信息、文献资源等接口服务。

## 认证方式

所有API请求需要在Header中携带API Key：

\`\`\`
X-API-Key: your_api_key
\`\`\`

或使用 Bearer Token：

\`\`\`
Authorization: Bearer your_api_key
\`\`\`

## 获取API Key

1. 登录开发者控制台
2. 进入 API Keys 管理页面
3. 创建新的 API Key
4. 保存 Key（只显示一次）

## 速率限制

- 默认限制：60 次/分钟
- 响应头包含速率限制信息：
  - \`X-RateLimit-Limit\`: 限制次数
  - \`X-RateLimit-Remaining\`: 剩余次数
  - \`X-RateLimit-Reset\`: 重置时间戳

## Demo API Key

用于测试的演示 Key（只读权限）：
\`\`\`
xny_pk_demo_1234567890abcdef
\`\`\`
        `.trim(),
        version: '1.0.0',
        contact: {
            name: '新能源智库技术支持',
            email: 'api-support@xinnengyuan.ai',
            url: 'https://xinnengyuan.ai/developer'
        },
        license: {
            name: 'MIT',
            url: 'https://opensource.org/licenses/MIT'
        }
    },
    servers: [
        {
            url: 'https://api.xinnengyuan.ai/v1',
            description: '生产环境'
        },
        {
            url: 'http://localhost:3001/api/v1',
            description: '开发环境'
        }
    ],
    security: [
        { ApiKeyAuth: [] }
    ],
    tags: [
        { name: 'Projects', description: '项目管理相关接口' },
        { name: 'Monitoring', description: '监控数据相关接口' },
        { name: 'Analytics', description: '分析数据相关接口' },
        { name: 'Papers', description: '文献资源相关接口' }
    ],
    paths: {
        '/projects': {
            get: {
                tags: ['Projects'],
                summary: '获取项目列表',
                description: '获取用户有权访问的所有项目列表，支持分页和过滤',
                operationId: 'listProjects',
                parameters: [
                    { name: 'page', in: 'query', schema: { type: 'integer', default: 1 }, description: '页码' },
                    { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 }, description: '每页数量' },
                    { name: 'type', in: 'query', schema: { type: 'string', enum: ['solar', 'wind', 'storage'] }, description: '项目类型' },
                    { name: 'status', in: 'query', schema: { type: 'string', enum: ['running', 'planning', 'warning'] }, description: '项目状态' }
                ],
                responses: {
                    '200': {
                        description: '成功返回项目列表',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ProjectListResponse' }
                            }
                        }
                    },
                    '401': { $ref: '#/components/responses/Unauthorized' },
                    '429': { $ref: '#/components/responses/RateLimited' }
                }
            }
        },
        '/projects/{id}': {
            get: {
                tags: ['Projects'],
                summary: '获取项目详情',
                description: '获取指定项目的详细信息，包括设备配置、运行指标等',
                operationId: 'getProject',
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: '项目ID' }
                ],
                responses: {
                    '200': {
                        description: '成功返回项目详情',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ProjectDetailResponse' }
                            }
                        }
                    },
                    '404': { $ref: '#/components/responses/NotFound' }
                }
            }
        },
        '/projects/{id}/monitoring': {
            get: {
                tags: ['Monitoring'],
                summary: '获取监控数据',
                description: '获取项目的时序监控数据，包括功率、效率、温度等指标',
                operationId: 'getMonitoring',
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: '项目ID' },
                    { name: 'range', in: 'query', schema: { type: 'string', enum: ['realtime', '1h', '24h', '7d', '30d'], default: '24h' }, description: '时间范围' },
                    { name: 'interval', in: 'query', schema: { type: 'string', enum: ['1m', '5m', '15m', '1h', '1d'], default: '1h' }, description: '数据间隔' }
                ],
                responses: {
                    '200': {
                        description: '成功返回监控数据',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/MonitoringResponse' }
                            }
                        }
                    }
                }
            }
        },
        '/projects/{id}/analytics': {
            get: {
                tags: ['Analytics'],
                summary: '获取性能分析',
                description: '获取项目的深度性能分析数据，包括效率分析、损失分解、对标分析等',
                operationId: 'getAnalytics',
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: '项目ID' },
                    { name: 'period', in: 'query', schema: { type: 'string', enum: ['7d', '30d', '90d', '1y'], default: '30d' }, description: '分析周期' }
                ],
                responses: {
                    '200': {
                        description: '成功返回分析数据',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/AnalyticsResponse' }
                            }
                        }
                    }
                }
            }
        },
        '/papers/search': {
            get: {
                tags: ['Papers'],
                summary: '搜索文献',
                description: '搜索新能源领域的学术文献',
                operationId: 'searchPapers',
                parameters: [
                    { name: 'q', in: 'query', required: true, schema: { type: 'string' }, description: '搜索关键词' },
                    { name: 'page', in: 'query', schema: { type: 'integer', default: 1 }, description: '页码' },
                    { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 }, description: '每页数量' },
                    { name: 'year', in: 'query', schema: { type: 'integer' }, description: '年份过滤' },
                    { name: 'sort', in: 'query', schema: { type: 'string', enum: ['relevance', 'citations', 'year'] }, description: '排序方式' }
                ],
                responses: {
                    '200': {
                        description: '成功返回搜索结果',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/PaperSearchResponse' }
                            }
                        }
                    }
                }
            }
        }
    },
    components: {
        securitySchemes: {
            ApiKeyAuth: {
                type: 'apiKey',
                in: 'header',
                name: 'X-API-Key',
                description: '使用 API Key 进行认证'
            }
        },
        schemas: {
            Project: {
                type: 'object',
                properties: {
                    id: { type: 'string', example: 'demo-1' },
                    name: { type: 'string', example: '北京朝阳分布式光伏示范站' },
                    type: { type: 'string', enum: ['solar', 'wind', 'storage'] },
                    capacity: { type: 'number', example: 120 },
                    capacityUnit: { type: 'string', example: 'kW' },
                    location: {
                        type: 'object',
                        properties: {
                            address: { type: 'string' },
                            lat: { type: 'number' },
                            lng: { type: 'number' }
                        }
                    },
                    status: { type: 'string', enum: ['running', 'planning', 'warning'] },
                    createdAt: { type: 'string', format: 'date-time' }
                }
            },
            Paper: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    title: { type: 'string' },
                    authors: { type: 'array', items: { type: 'string' } },
                    year: { type: 'integer' },
                    journal: { type: 'string' },
                    abstract: { type: 'string' },
                    keywords: { type: 'array', items: { type: 'string' } },
                    citations: { type: 'integer' },
                    doi: { type: 'string' }
                }
            },
            Pagination: {
                type: 'object',
                properties: {
                    page: { type: 'integer' },
                    limit: { type: 'integer' },
                    total: { type: 'integer' },
                    totalPages: { type: 'integer' },
                    hasMore: { type: 'boolean' }
                }
            },
            Error: {
                type: 'object',
                properties: {
                    code: { type: 'string' },
                    message: { type: 'string' }
                }
            }
        },
        responses: {
            Unauthorized: {
                description: '认证失败',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                success: { type: 'boolean', example: false },
                                error: { $ref: '#/components/schemas/Error' }
                            }
                        }
                    }
                }
            },
            NotFound: {
                description: '资源不存在',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                success: { type: 'boolean', example: false },
                                error: { $ref: '#/components/schemas/Error' }
                            }
                        }
                    }
                }
            },
            RateLimited: {
                description: '请求频率超限',
                headers: {
                    'X-RateLimit-Limit': { schema: { type: 'integer' }, description: '限制次数' },
                    'X-RateLimit-Remaining': { schema: { type: 'integer' }, description: '剩余次数' },
                    'Retry-After': { schema: { type: 'integer' }, description: '重试等待秒数' }
                },
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                success: { type: 'boolean', example: false },
                                error: { $ref: '#/components/schemas/Error' }
                            }
                        }
                    }
                }
            }
        }
    }
};

export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const format = url.searchParams.get('format') || 'json';

    if (format === 'yaml') {
        // 简化的 YAML 转换
        const yamlContent = JSON.stringify(openApiSpec, null, 2)
            .replace(/"/g, '')
            .replace(/,$/gm, '');

        return new NextResponse(yamlContent, {
            headers: {
                'Content-Type': 'text/yaml'
            }
        });
    }

    return NextResponse.json(openApiSpec);
}
