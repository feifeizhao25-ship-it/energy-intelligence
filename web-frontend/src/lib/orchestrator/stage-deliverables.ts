/**
 * 阶段-交付物映射系统
 * 
 * 明确每个项目阶段应产出什么标准化交付物
 * 这是"工作流OS"的核心：让用户知道"现在该做什么"和"做完能得到什么"
 */

import { QualityTag } from '../kernel/calculation-result';
import { DeliverableType, Deliverable Spec } from './deliverable-actions';

/**
 * 项目阶段
 */
export type ProjectStage =
    | "SITE_SELECTION"      // 选址阶段
    | "ECONOMICS_ANALYSIS"  // 经济性分析
    | "DESIGN"              // 设计阶段
    | "CONSTRUCTION"        // 建设阶段
    | "COMMISSIONING"       // 调试阶段
    | "OPERATIONS"          //运维阶段
    | "OPTIMIZATION";       // 优化阶段

/**
 * 阶段交付物定义
 */
export interface StageDeliverable {
    /** 交付物名称 */
    name: string;

    /** 交付物规格 */
    spec: DeliverableSpec;

    /** 是否为该阶段的主要交付物 */
    isPrimary: boolean;

    /** 需要的前置数据 */
    requiredData: string[];

    /** 需要的前置动作 */
    requiredActions: string[];

    /** 是否需要证据链 */
    evidenceRequired: boolean;

    /** 典型使用场景 */
    useCase: string;

    /** 交付对象（谁需要这个交付物） */
    stakeholders: string[];
}

/**
 * 阶段定义
 */
export interface StageDefinition {
    /** 阶段ID */
    stage: ProjectStage;

    /** 阶段名称 */
    name: string;

    /** 阶段描述 */
    description: string;

    /** 该阶段的目标 */
    objectives: string[];

    /** 主要交付物 */
    primaryDeliverable: StageDeliverable;

    /** 可选交付物 */
    optionalDeliverables: StageDeliverable[];

    /** 进入该阶段的条件 */
    entryConditions: string[];

    /** 完成该阶段的标准 */
    exitCriteria: string[];

    /** 下一阶段 */
    nextStages: ProjectStage[];

    /** 典型耗时（天） */
    typicalDuration: number;
}

/**
 * 阶段-交付物映射配置
 */
export const STAGE_DELIVERABLES: Record<ProjectStage, StageDefinition> = {
    SITE_SELECTION: {
        stage: "SITE_SELECTION",
        name: "选址阶段",
        description: "评估潜在项目地点的资源条件和政策环境",
        objectives: [
            "确定最佳项目地点",
            "评估太阳/风资源潜力",
            "了解当地政策支持"
        ],
        primaryDeliverable: {
            name: "资源评估报告",
            spec: {
                type: "REPORT",
                title: "太阳能/风能资源评估报告",
                description: "包含GHI/DNI/风速数据、年均发电小时数、最佳倾角/轮毂高度建议",
                template: "resource-assessment",
                estimatedTime: 30,
                requiredQuality: "STANDARD",
                formats: ["PDF", "EXCEL"],
                includes: [
                    "年均辐照度/风速数据",
                    "逐月资源曲线",
                    "数据来源证明（NASA POWER/Open-Meteo）",
                    "历史数据分析（10年+）",
                    "极端天气评估",
                    "遮挡分析（如适用）"
                ],
                externalSubmission: true
            },
            isPrimary: true,
            requiredData: ["地理位置", "项目类型"],
            requiredActions: ["获取辐照数据", "获取气象数据"],
            evidenceRequired: true,
            useCase: "向投资方证明该地点具有开发价值",
            stakeholders: ["投资方", "技术团队", "项目经理"]
        },
        optionalDeliverables: [
            {
                name: "政策文件清单",
                spec: {
                    type: "ANALYSIS",
                    title: "地方政策支持文件",
                    description: "收集当地补贴政策、上网电价、土地政策等",
                    template: "policy-summary",
                    estimatedTime: 20,
                    requiredQuality: "PREVIEW",
                    formats: ["PDF"],
                    includes: ["补贴政策", "电价政策", "土地政策", "并网要求"],
                    externalSubmission: false
                },
                isPrimary: false,
                requiredData: ["项目地区"],
                requiredActions: ["政策爬取"],
                evidenceRequired: false,
                useCase: "政策可行性评估",
                stakeholders: ["法务团队", "财务团队"]
            }
        ],
        entryConditions: ["项目立项", "确定大致地区"],
        exitCriteria: ["资源评估报告完成", "地点确定"],
        nextStages: ["ECONOMICS_ANALYSIS"],
        typicalDuration: 7
    },

    ECONOMICS_ANALYSIS: {
        stage: "ECONOMICS_ANALYSIS",
        name: "经济性分析",
        description: "评估项目的财务可行性和投资回报",
        objectives: [
            "计算IRR/NPV/LCOE",
            "分析投资回收期",
            "评估财务风险"
        ],
        primaryDeliverable: {
            name: "投资分析报告",
            spec: {
                type: "REPORT",
                title: "项目投资分析报告（审计级）",
                description: "符合银行审计要求的完整财务分析报告",
                template: "investment-analysis",
                estimatedTime: 60,
                requiredQuality: "AUDIT_GRADE",
                formats: ["PDF", "EXCEL"],
                includes: [
                    "封面页（项目概况、口径版本v2024.1）",
                    "执行摘要（IRR、NPV、LCOE、回收期）",
                    "详细分析",
                    "  - 投资估算（初始投资、运维成本）",
                    "  - 收益测算（25年现金流表）",
                    "  - 财务指标（IRR、NPV、LCOE、利润率）",
                    "  - 敏感性分析（电价±10%、投资±10%、辐照±5%）",
                    "证据附件",
                    "  - 数据来源（NASA POWER、电价政策）",
                    "  - 口径说明（IEC 61724-1:2017、NREL ATB 2023）",
                    "  - 关键假设（折现率8%、衰减率0.5%/年）",
                    "  - 中间变量（系统效率、温度系数等）",
                    "不确定性分析",
                    "  - 95%置信区间",
                    "  - 误差边界",
                    "  - 敏感性因子排序",
                    "合规声明",
                    "  - 行业标准引用",
                    "  - 计算口径说明",
                    "  - 免责声明",
                    "审计元数据",
                    "  - 防篡改哈希",
                    "  - 可复现命令",
                    "  - 生成时间、版本"
                ],
                externalSubmission: true
            },
            isPrimary: true,
            requiredData: [
                "太阳/风资源数据",
                "装机容量",
                "单位投资成本",
                "电价/补贴"
            ],
            requiredActions: [
                "获取资源数据",
                "获取电价政策",
                "执行财务计算"
            ],
            evidenceRequired: true,
            useCase: "向银行申请项目贷款，向董事会申请投资批准",
            stakeholders: ["银行", "投资方", "董事会", "财务总监"]
        },
        optionalDeliverables: [
            {
                name: "敏感性分析专题",
                spec: {
                    type: "ANALYSIS",
                    title: "敏感性分析报告",
                    description: "深入分析各参数变化对IRR的影响",
                    template: "sensitivity-analysis",
                    estimatedTime: 30,
                    requiredQuality: "STANDARD",
                    formats: ["PDF", "EXCEL"],
                    includes: [
                        "单因素敏感性分析",
                        "多因素组合分析",
                        "蒙特卡洛模拟",
                        "风险概率分布"
                    ],
                    externalSubmission: true
                },
                isPrimary: false,
                requiredData: ["投资分析结果"],
                requiredActions: ["财务计算"],
                evidenceRequired: false,
                useCase: "风险评估与决策支持",
                stakeholders: ["风控团队", "高管"]
            }
        ],
        entryConditions: ["资源评估完成", "技术方案初步确定"],
        exitCriteria: [
            "IRR满足投资要求（通常>8%）",
            "NPV为正",
            "投资分析报告通过审核"
        ],
        nextStages: ["DESIGN", "SITE_SELECTION"], // 可能回到选址
        typicalDuration: 14
    },

    DESIGN: {
        stage: "DESIGN",
        name: "设计阶段",
        description: "完成详细设计和设备选型",
        objectives: [
            "完成详细技术方案",
            "确定设备清单",
            "优化系统配置"
        ],
        primaryDeliverable: {
            name: "详细设计方案",
            spec: {
                type: "REPORT",
                title: "项目详细设计方案",
                description: "包含组件选型、系统配置、电气设计等",
                template: "detailed-design",
                estimatedTime: 120,
                requiredQuality: "STANDARD",
                formats: ["PDF", "DOCX"],
                includes: [
                    "组件选型报告",
                    "逆变器配置方案",
                    "电气系统设计",
                    "布局平面图",
                    "施工图纸"
                ],
                externalSubmission: true
            },
            isPrimary: true,
            requiredData: ["投资分析结果", "场地条件"],
            requiredActions: ["设备选型", "系统优化"],
            evidenceRequired: false,
            useCase: "指导施工和设备采购",
            stakeholders: ["施工方", "设备供应商", "设计院"]
        },
        optionalDeliverables: [],
        entryConditions: ["投资决策通过", "场地确定"],
        exitCriteria: ["设计方案通过审查", "施工图完成"],
        nextStages: ["CONSTRUCTION"],
        typicalDuration: 30
    },

    CONSTRUCTION: {
        stage: "CONSTRUCTION",
        name: "建设阶段",
        description: "项目施工建设",
        objectives: [
            "按设计施工",
            "质量控制",
            "进度管理"
        ],
        primaryDeliverable: {
            name: "施工进度报告",
            spec: {
                type: "REPORT",
                title: "施工进度月报",
                description: "记录施工进度、质量检查、问题处理",
                template: "construction-progress",
                estimatedTime: 15,
                requiredQuality: "PREVIEW",
                formats: ["PDF"],
                includes: [
                    "进度统计",
                    "质量检查记录",
                    "问题清单",
                    "照片记录"
                ],
                externalSubmission: false
            },
            isPrimary: true,
            requiredData: ["施工计划", "实际进度"],
            requiredActions: ["进度跟踪"],
            evidenceRequired: false,
            useCase: "项目管理与汇报",
            stakeholders: ["项目经理", "业主", "监理"]
        },
        optionalDeliverables: [],
        entryConditions: ["施工许可获得", "设备采购完成"],
        exitCriteria: ["施工完成", "质量验收合格"],
        nextStages: ["COMMISSIONING"],
        typicalDuration: 60
    },

    COMMISSIONING: {
        stage: "COMMISSIONING",
        name: "调试阶段",
        description: "系统调试和并网测试",
        objectives: [
            "系统调试",
            "并网测试",
            "性能验收"
        ],
        primaryDeliverable: {
            name: "调试验收报告",
            spec: {
                type: "CERTIFICATE",
                title: "系统调试与并网验收报告",
                description: "证明系统满足设计要求并成功并网",
                template: "commissioning-report",
                estimatedTime: 40,
                requiredQuality: "STANDARD",
                formats: ["PDF"],
                includes: [
                    "调试测试记录",
                    "并网检测报告",
                    "性能测试结果",
                    "验收签字"
                ],
                externalSubmission: true
            },
            isPrimary: true,
            requiredData: ["测试数据"],
            requiredActions: ["系统调试", "并网测试"],
            evidenceRequired: true,
            useCase: "并网许可和质保启动",
            stakeholders: ["电网公司", "业主", "EPC"]
        },
        optionalDeliverables: [],
        entryConditions: ["施工完成", "设备安装完成"],
        exitCriteria: ["并网成功", "性能达标"],
        nextStages: ["OPERATIONS"],
        typicalDuration: 14
    },

    OPERATIONS: {
        stage: "OPERATIONS",
        name: "运维阶段",
        description: "日常运维和性能监控",
        objectives: [
            "保持系统高效运行",
            "及时发现和处理故障",
            "优化发电性能"
        ],
        primaryDeliverable: {
            name: "运维月报",
            spec: {
                type: "REPORT",
                title: "电站运维月度报告",
                description: "包含PR分析、发电统计、故障处理记录",
                template: "monthly-operations-report",
                estimatedTime: 20,
                requiredQuality: "STANDARD",
                formats: ["PDF", "EXCEL"],
                includes: [
                    "发电量统计（月度、累计）",
                    "PR分析（实际vs理论）",
                    "故障记录与处理",
                    "维护作业记录",
                    "收益统计",
                    "下月计划"
                ],
                externalSubmission: true
            },
            isPrimary: true,
            requiredData: ["监测数据", "发电数据"],
            requiredActions: ["数据采集", "PR计算"],
            evidenceRequired: true,
            useCase: "向业主汇报运营效果",
            stakeholders: ["业主", "运维团队", "资产管理公司"]
        },
        optionalDeliverables: [
            {
                name: "诊断报告",
                spec: {
                    type: "DIAGNOSTIC",
                    title: "系统诊断与优化建议",
                    description: "基于监测数据的深度诊断分析",
                    template: "diagnostic-report",
                    estimatedTime: 30,
                    requiredQuality: "STANDARD",
                    formats: ["PDF"],
                    includes: [
                        "PR趋势分析",
                        "故障诊断",
                        "损失量化",
                        "清洗建议",
                        "维修建议"
                    ],
                    externalSubmission: false
                },
                isPrimary: false,
                requiredData: ["连续监测数据"],
                requiredActions: ["运行诊断"],
                evidenceRequired: true,
                useCase: "发现问题，减少损失",
                stakeholders: ["运维团队", "技术负责人"]
            }
        ],
        entryConditions: ["并网成功", "进入稳定运行"],
        exitCriteria: [], // 持续阶段
        nextStages: ["OPTIMIZATION"],
        typicalDuration: 9125 // 25年
    },

    OPTIMIZATION: {
        stage: "OPTIMIZATION",
        name: "优化阶段",
        description: "系统性能优化和改造",
        objectives: [
            "提升发电效率",
            "降低运维成本",
            "延长系统寿命"
        ],
        primaryDeliverable: {
            name: "优化方案",
            spec: {
                type: "RECOMMENDATION",
                title: "系统优化建议方案",
                description: "基于历史数据的优化改造建议",
                template: "optimization-proposal",
                estimatedTime: 40,
                requiredQuality: "STANDARD",
                formats: ["PDF"],
                includes: [
                    "问题诊断",
                    "优化方案",
                    "投资估算",
                    "预期收益",
                    "实施计划"
                ],
                externalSubmission: true
            },
            isPrimary: true,
            requiredData: ["历史运行数据", "故障记录"],
            requiredActions: ["性能分析", "方案设计"],
            evidenceRequired: true,
            useCase: "争取优化改造投资",
            stakeholders: ["业主", "投资方", "技术团队"]
        },
        optionalDeliverables: [],
        entryConditions: ["运行1年+", "发现优化空间"],
        exitCriteria: ["优化方案通过", "改造实施"],
        nextStages: ["OPERATIONS"],
        typicalDuration: 30
    }
};

/**
 * 阶段管理器
 */
export class StageManager {
    /**
     * 获取阶段定义
     */
    static getStageDefinition(stage: ProjectStage): StageDefinition {
        return STAGE_DELIVERABLES[stage];
    }

    /**
     * 获取阶段的主要交付物
     */
    static getPrimaryDeliverable(stage: ProjectStage): StageDeliverable {
        return STAGE_DELIVERABLES[stage].primaryDeliverable;
    }

    /**
     * 检查是否满足阶段进入条件
     */
    static canEnterStage(
        stage: ProjectStage,
        projectState: any
    ): { canEnter: boolean; missingConditions: string[] } {
        const definition = this.getStageDefinition(stage);
        const missing: string[] = [];

        // TODO: 实际检查逻辑
        // 示例：
        // if (stage === "ECONOMICS_ANALYSIS" && !projectState.hasResourceData) {
        //   missing.push("缺少资源评估数据");
        // }

        return {
            canEnter: missing.length === 0,
            missingConditions: missing
        };
    }

    /**
     * 检查是否满足阶段退出标准
     */
    static canExitStage(
        stage: ProjectStage,
        projectState: any
    ): { canExit: boolean; missingCriteria: string[] } {
        const definition = this.getStageDefinition(stage);
        const missing: string[] = [];

        // TODO: 实际检查逻辑

        return {
            canExit: missing.length === 0,
            missingCriteria: missing
        };
    }

    /**
     * 获取下一阶段建议
     */
    static getNextStages(currentStage: ProjectStage): ProjectStage[] {
        return STAGE_DELIVERABLES[currentStage].nextStages;
    }

    /**
     * 获取阶段进度百分比
     */
    static getStageProgress(
        stage: ProjectStage,
        projectState: any
    ): number {
        const definition = this.getStageDefinition(stage);

        // 基于交付物完成情况计算进度
        let completed = 0;
        let total = 1; // 至少有主要交付物

        if (projectState.primaryDeliverableCompleted) completed++;
        total += definition.optionalDeliverables.length;
        completed += projectState.optionalDeliverablesCompleted || 0;

        return completed / total;
    }
}

/**
 * 使用示例：
 * 
 * // 获取当前阶段的定义
 * const stageDef = StageManager.getStageDefinition("ECONOMICS_ANALYSIS");
 * console.log(stageDef.primaryDeliverable.name); // "投资分析报告"
 * 
 * // 检查是否可以进入下一阶段
 * const canEnter = StageManager.canEnterStage("DESIGN", projectState);
 * if (!canEnter.canEnter) {
 *   console.log("缺少条件:", canEnter.missingConditions);
 * }
 * 
 * // 生成阶段报告
 * const primaryDeliverable = StageManager.getPrimaryDeliverable("ECONOMICS_ANALYSIS");
 * console.log(`需要生成: ${primaryDeliverable.name}`);
 * console.log(`预计耗时: ${primaryDeliverable.spec.estimatedTime}分钟`);
 * console.log(`质量要求: ${primaryDeliverable.spec.requiredQuality}`);
 */
