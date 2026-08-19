import { MaintenancePlan } from './types';

/**
 * 预测性维护建议
 */
export async function predictMaintenance(input: {
    name: string;
    commissionDate: string;
    capacity: number;
}): Promise<MaintenancePlan> {
    const { name, commissionDate, capacity } = input;

    const commDate = new Date(commissionDate);
    const today = new Date();
    const years = (today.getTime() - commDate.getTime()) / (1000 * 60 * 60 * 24 * 365);

    // 行业经验评估
    const assessments = [
        {
            component: "光伏组件",
            status: years < 5 ? "早期运行期" : "中期稳定期",
            remainingLife: `${(25 - years).toFixed(1)} 年`,
            recommendation: years > 3 ? "建议安排 EL 抽检，排查衰减情况" : "日常巡检，重点关注积灰"
        },
        {
            component: "逆变器散热系统",
            status: years > 3 ? "损耗预警" : "良好",
            remainingLife: `${Math.max(0, 5 - years).toFixed(1)} 年 (风扇寿命)`,
            recommendation: "每季度深度清洁风道，运行 5 年建议预防性更换风扇"
        },
        {
            component: "汇流箱与熔丝",
            status: "老化监测",
            remainingLife: "需现场测试",
            recommendation: "每年雷季前必须检查防雷器状态"
        },
        {
            component: "电缆及连接端子",
            status: "良好",
            remainingLife: "> 10 年",
            recommendation: "红外热成像抽检各接头是否有异常发热"
        }
    ];

    // 年度维护日历
    const calendar = [
        { month: "1月", tasks: ["年度大巡检", "逆变器停电清洁"] },
        { month: "3月", tasks: ["防雷器专项检查 (迎接雷季)"] },
        { month: "4月", tasks: ["春季组件深度清洗"] },
        { month: "6月", tasks: ["高温巡检", "散热系统检查"] },
        { month: "9月", tasks: ["秋季组件清洗"] },
        { month: "11月", tasks: ["支架基础检查"] }
    ];

    // 预算估算 (¥/kW/year)
    const baseCost = 25; // 基础 25 元
    const agingCost = years * 2; // 老化增加成本
    const totalRate = Math.min(50, baseCost + agingCost);

    const totalBudget = capacity * totalRate;

    return {
        stationInfo: {
            name,
            commissionDate,
            serviceLifespan: "25 年"
        },
        assessments,
        calendar,
        budgetEstimate: {
            total: totalBudget,
            breakdown: [
                { item: "日常巡检人工", cost: totalBudget * 0.4 },
                { item: "组件清洗 (2次/年)", cost: totalBudget * 0.2 },
                { item: "备品备件及耗材", cost: totalBudget * 0.2 },
                { item: "专业检测 (EL/红外)", cost: totalBudget * 0.2 }
            ],
            benchmark: "20-50 元/kW/年 (行业标准水平)"
        }
    };
}
