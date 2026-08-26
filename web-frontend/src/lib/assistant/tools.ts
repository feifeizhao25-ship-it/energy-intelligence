import { executeTool } from "@/lib/ai/tool-executor";

/**
 * 为 AI 助手准备的工具定义 (OpenAI 格式)
 * 挑选最核心的几个工具暴露给 AI 助手，避免上下文过载
 */
export const assistantToolDefinitions = [
    {
        type: "function",
        function: {
            name: "geocode_address",
            description: "将地名（如：北京、河北保定）转换为经纬度坐标。当用户询问特定地点的资源但未提供经纬度时，请先调用此工具。",
            parameters: {
                type: "object",
                properties: {
                    address: { type: "string", description: "详细地址或城市名" }
                },
                required: ["address"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_solar_resource",
            description: "获取指定经纬度的年均太阳能辐射数据（GHI, DNI, DIFF等）",
            parameters: {
                type: "object",
                properties: {
                    lat: { type: "number", description: "纬度" },
                    lng: { type: "number", description: "经度" }
                },
                required: ["lat", "lng"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "calculate_solar",
            description: "执行详细的光伏投资收益测算。当用户提供电价、自用比例或安装类型等具体信息时使用。",
            parameters: {
                type: "object",
                properties: {
                    lat: { type: "number" },
                    lng: { type: "number" },
                    capacity: { type: "number", description: "装机容量(kW)" },
                    province: { type: "string", description: "省份名称（用于匹配电价）" },
                    installationType: {
                        type: "string",
                        enum: ["roof", "ground", "carport", "bifacial"],
                        description: "安装形式：屋顶(roof)、地面(ground)、车棚(carport)、双面(bifacial)"
                    },
                    moduleType: {
                        type: "string",
                        enum: ["economy", "standard", "premium"],
                        description: "组件类型：经济型(economy)、标准型(standard)、高效型(premium)"
                    },
                    selfUseRatio: {
                        type: "number",
                        description: "自发自用比例 (0-1)，默认 0.7"
                    }
                },
                required: ["lat", "lng", "capacity", "province"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "search_papers",
            description: "搜索新能源领域的学术文献 (Semantic Scholar & arXiv)。可以按年份过滤。",
            parameters: {
                type: "object",
                properties: {
                    query: { type: "string", description: "搜索关键词或学术领域" },
                    yearFrom: { type: "number", description: "从哪一年开始 (YYYY)" },
                    limit: { type: "number", default: 5 }
                },
                required: ["query"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "compare_locations",
            description: "对比多个地点的资源禀赋（光、风、互补性等）。",
            parameters: {
                type: "object",
                properties: {
                    locations: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                lat: { type: "number" },
                                lng: { type: "number" },
                                name: { type: "string" }
                            },
                            required: ["lat", "lng", "name"]
                        }
                    }
                },
                required: ["locations"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "generate_resource_report",
            description: "生成指定地点的详细资源评估报告。包含资源评分、互补性分析及各种图表数据。",
            parameters: {
                type: "object",
                properties: {
                    lat: { type: "number" },
                    lng: { type: "number" },
                    name: { type: "string", description: "项目或地点名称" },
                    reportType: {
                        type: "string",
                        enum: ["solar", "wind", "hybrid"],
                        description: "报告类型：纯光(solar)、纯风(wind)、风光互补(hybrid)"
                    }
                },
                required: ["lat", "lng", "name", "reportType"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "diagnose_system_health",
            description: "根据实际发电量诊断光伏电站健康状态(PR分析)。当用户询问“发电量是否正常”或提供具体发电量数据时使用。",
            parameters: {
                type: "object",
                properties: {
                    lat: { type: "number" },
                    lng: { type: "number" },
                    capacity: { type: "number", description: "装机容量(kWp)" },
                    actualGeneration: { type: "number", description: "实际月发电量(kWh)" },
                    month: { type: "number", description: "月份(1-12)" },
                    year: { type: "number", description: "年份(YYYY)" }
                },
                required: ["lat", "lng", "capacity", "actualGeneration"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "query_knowledge_base",
            description: "检索用户的私有知识库或已收藏论文的详细内容。当用户提问涉及“我之前上传的文档”、“我的收藏”或特定论文细节时，**必须**调用此工具。",
            parameters: {
                type: "object",
                properties: {
                    query: { type: "string", description: "要在知识库中搜索的问题或关键词" },
                    documentId: { type: "string", description: "可选：指定要检索的特定论文/文档 ID" }
                },
                required: ["query"]
            }
        }
    }
];

/**
 * 工具执行适配器
 */
export async function handleToolCall(name: string, args: string | object, userId?: string) {
    const parsedArgs = typeof args === 'string' ? JSON.parse(args) : args;
    console.log(`[Assistant Tool] Executing ${name}:`, parsedArgs);
    return await executeTool(name, { ...parsedArgs, userId });
}
