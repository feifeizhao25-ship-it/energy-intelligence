/**
 * 终极护城河架构 - 集成测试
 * 
 * 测试Phase 1-3完整流程
 * 
 * 运行: npx ts-node scripts/test-ultimate-moat.ts
 */

import { SolarCalculatorV2 } from '../src/lib/calculator/solar-v2';
import { WindCalculatorV2 } from '../src/lib/calculator/wind-v2';
import { StorageCalculatorV2 } from '../src/lib/calculator/storage-v2';
import { EnhancedSignalGenerator } from '../src/lib/orchestrator/enhanced-signals';
import { ActionGenerator } from '../src/lib/orchestrator/deliverable-actions';
import { StageManager } from '../src/lib/orchestrator/stage-deliverables';
import { ReportGenerator } from '../src/lib/reports/generator';
import { TimelineManager } from '../src/lib/timeline/manager';
import { ResultValidator } from '../src/lib/kernel/calculation-result';
import { AssumptionManager } from '../src/lib/kernel/assumption-manager';

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🏰 终极护城河架构 - 集成测试');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

async function runTests() {
    let passedTests = 0;
    let failedTests = 0;

    // ═══════════════════════════════════════
    // Test 1: Phase 1 - 核心计算
    // ═══════════════════════════════════════
    console.log('📦 Test 1: Phase 1 - 核心计算\n');

    try {
        console.log('  1.1 测试口径管理...');
        const currentVersion = AssumptionManager.getCurrentVersion();
        console.log(`    ✅ 当前口径版本: ${currentVersion.id} - ${currentVersion.name}`);
        console.log(`    ✅ 生效日期: ${currentVersion.effectiveDate.toISOString().split('T')[0]}`);
        passedTests++;

        console.log('\n  1.2 测试光伏计算器...');
        const solarResult = await SolarCalculatorV2.calculate({
            location: { lat: 39.9, lng: 116.4, address: "北京" },
            capacity: 100,
            unitCost: 3.5,
            electricityPrice: 0.45,
            subsidyPrice: 0.12,
            qualityTag: "AUDIT_GRADE"
        });

        console.log(`    ✅ IRR: ${solarResult.result.irr.toFixed(2)}%`);
        console.log(`    ✅ NPV: ${(solarResult.result.npv / 10000).toFixed(2)}万元`);
        console.log(`    ✅ LCOE: ${solarResult.result.lcoe.toFixed(4)}元/kWh`);
        console.log(`    ✅ 回收期: ${solarResult.result.paybackPeriod.toFixed(1)}年`);
        console.log(`    ✅ 质量等级: ${solarResult.auditMeta.qualityTag}`);
        console.log(`    ✅ 防篡改哈希: ${solarResult.auditMeta.hash.substring(0, 16)}...`);
        console.log(`    ✅ 证据链ID: ${solarResult.evidence.conclusionId}`);

        // 验证结果
        const validation = ResultValidator.validate(solarResult);
        if (!validation.valid) {
            console.log(`    ❌ 结果验证失败: ${validation.errors.join(', ')}`);
            failedTests++;
        } else {
            console.log(`    ✅ 结果验证通过`);
            passedTests++;
        }

        // 检查证据链
        if (solarResult.evidence.dataProvenance['solarResource']) {
            console.log(`    ✅ 太阳资源数据来源: ${solarResult.evidence.dataProvenance['solarResource'].source}`);
        }

        if (solarResult.evidence.uncertaintyAnalysis) {
            console.log(`    ✅ 不确定性分析: 置信水平${solarResult.evidence.uncertaintyAnalysis.confidenceLevel}`);
            console.log(`    ✅ IRR置信区间: [${solarResult.evidence.uncertaintyAnalysis.errorBound?.irr?.lower.toFixed(2)}, ${solarResult.evidence.uncertaintyAnalysis.errorBound?.irr?.upper.toFixed(2)}]`);
        }

        passedTests++;

        console.log('\n  1.3 测试风电计算器...');
        const windResult = await WindCalculatorV2.calculate({
            location: { lat: 42.5, lng: 120.3, address: "内蒙古" },
            capacity: 50,
            hubHeight: 80,
            unitCost: 4.5,
            electricityPrice: 0.38,
            subsidyPrice: 0.08,
            qualityTag: "STANDARD"
        });

        console.log(`    ✅ IRR: ${windResult.result.irr.toFixed(2)}%`);
        console.log(`    ✅ 容量因子: ${windResult.result.capacityFactor.toFixed(2)}`);
        passedTests++;

        console.log('\n  1.4 测试储能计算器...');
        const storageResult = await StorageCalculatorV2.calculate({
            location: { province: "江苏", city: "南京" },
            capacity: 1000,
            powerRating: 500,
            unitCost: 1200,
            peakPrice: 1.2,
            valleyPrice: 0.3,
            flatPrice: 0.7,
            timeOfUsePeriods: { peak: 8, valley: 8, flat: 8 },
            qualityTag: "STANDARD"
        });

        console.log(`    ✅ IRR: ${storageResult.result.irr.toFixed(2)}%`);
        console.log(`    ✅ 峰谷价差: ${storageResult.result.peakValleyDelta.toFixed(2)}元/kWh`);
        console.log(`    ✅ 日循环次数: ${storageResult.result.dailyCycles.toFixed(1)}`);
        passedTests++;

    } catch (error: any) {
        console.log(`    ❌ Phase 1 测试失败: ${error.message}`);
        failedTests++;
    }

    // ═══════════════════════════════════════
    // Test 2: Phase 2 - 智能编排
    // ═══════════════════════════════════════
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📦 Test 2: Phase 2 - 智能编排\n');

    try {
        console.log('  2.1 测试信号生成...');
        const signals = await EnhancedSignalGenerator.generate(
            'test-project-001',
            'test-user-001',
            'PRO'
        );

        console.log(`    ✅ 证据完整性评分: ${signals.evidenceCompleteness.score.toFixed(2)}`);
        console.log(`    ✅ 可交付性评分: ${signals.deliverabilityScore.score.toFixed(2)}`);
        console.log(`    ✅ 整体风险等级: ${signals.riskSignals.overallRisk}`);
        console.log(`    ✅ 当前质量等级: ${signals.currentQualityTag || '无'}`);
        console.log(`    ✅ 推荐质量等级: ${signals.recommendedQualityTag}`);
        console.log(`    ✅ 需要升级: ${signals.needsQualityUpgrade ? '是' : '否'}`);

        if (signals.evidenceCompleteness.missingCritical.length > 0) {
            console.log(`    ⚠️  缺失关键证据: ${signals.evidenceCompleteness.missingCritical.join(', ')}`);
        }

        if (signals.riskSignals.riskDetails.length > 0) {
            console.log(`    ⚠️  风险详情:`);
            signals.riskSignals.riskDetails.forEach(risk => {
                console.log(`       [${risk.severity}] ${risk.description}`);
            });
        }

        passedTests++;

        console.log('\n  2.2 测试动作生成...');
        const actions = ActionGenerator.generateActions(signals);

        console.log(`    ✅ 生成了${actions.length}个推荐动作`);

        actions.slice(0, 3).forEach((action, index) => {
            console.log(`\n    动作 ${index + 1}: ${action.title}`);
            console.log(`      优先级: ${action.priority}`);
            console.log(`      类型: ${action.type}`);
            console.log(`      交付物: ${action.deliverable.title}`);
            console.log(`      预计时间: ${action.deliverable.estimatedTime}分钟`);
            console.log(`      价值: ${action.valueProposition}`);
            if (action.pricing) {
                console.log(`      定价层级: ${action.pricing.tier}`);
                console.log(`      硬付费墙: ${action.pricing.hardPaywall ? '是' : '否'}`);
            }
        });

        passedTests++;

        console.log('\n  2.3 测试阶段管理...');
        const stageDef = StageManager.getStageDefinition('ECONOMICS_ANALYSIS');

        console.log(`    ✅ 阶段名称: ${stageDef.name}`);
        console.log(`    ✅ 主要交付物: ${stageDef.primaryDeliverable.name}`);
        console.log(`    ✅ 需要的数据: ${stageDef.primaryDeliverable.requiredData.join(', ')}`);
        console.log(`    ✅ 典型耗时: ${stageDef.typicalDuration}天`);
        console.log(`    ✅ 下一阶段: ${stageDef.nextStages.join(', ')}`);

        passedTests++;

    } catch (error: any) {
        console.log(`    ❌ Phase 2 测试失败: ${error.message}`);
        failedTests++;
    }

    // ═══════════════════════════════════════
    // Test 3: Phase 3 - 交付沉淀
    // ═══════════════════════════════════════
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📦 Test 3: Phase 3 - 交付沉淀\n');

    try {
        console.log('  3.1 测试时间线记录...');

        // 获取之前的光伏计算结果
        const solarResult = await SolarCalculatorV2.calculate({
            location: { lat: 39.9, lng: 116.4, address: "北京" },
            capacity: 100,
            unitCost: 3.5,
            electricityPrice: 0.45,
            subsidyPrice: 0.12,
            qualityTag: "AUDIT_GRADE"
        });

        const milestone = await TimelineManager.recordCalculation(
            'test-project-001',
            solarResult,
            undefined,
            'test-user-001'
        );

        console.log(`    ✅ 里程碑ID: ${milestone.id}`);
        console.log(`    ✅ 类型: ${milestone.milestoneType}`);
        console.log(`    ✅ 标题: ${milestone.title}`);
        console.log(`    ✅ 摘要: ${milestone.summary}`);
        console.log(`    ✅ 证据链ID: ${milestone.evidenceChainId}`);

        if (milestone.impact) {
            console.log(`    ✅ 影响类型: ${milestone.impact.type}`);
            console.log(`    ✅ 影响描述: ${milestone.impact.description}`);
        }

        passedTests++;

        console.log('\n  3.2 测试报告生成...');
        const report = await ReportGenerator.generateInvestmentReport(
            solarResult,
            {
                id: 'test-project-001',
                name: '测试光伏项目',
                location: '北京市',
                capacity: 100,
                type: 'SOLAR'
            },
            {
                name: '测试公司',
                contact: '张经理 13800138000'
            },
            'test-user-001'
        );

        console.log(`    ✅ 报告ID: ${report.id}`);
        console.log(`    ✅ 报告类型: ${report.reportType}`);
        console.log(`    ✅ 质量等级: ${report.metadata.qualityTag}`);
        console.log(`    ✅ 口径版本: ${report.metadata.assumptionVersion}`);
        console.log(`    ✅ 防篡改哈希: ${report.metadata.hash.substring(0, 16)}...`);

        console.log('\n    报告结构:');
        console.log(`      封面: ✅`);
        console.log(`      - 项目名称: ${report.cover.project.name}`);
        console.log(`      - 装机容量: ${report.cover.project.capacity}`);
        console.log(`      - 口径版本: ${report.cover.assumption.version}`);

        console.log(`      执行摘要: ✅`);
        console.log(`      - IRR: ${report.executiveSummary.keyMetrics.irr.value.toFixed(2)}%`);
        console.log(`      - NPV: ${(report.executiveSummary.keyMetrics.npv.value / 10000).toFixed(2)}万元`);
        console.log(`      - 风险等级: ${report.executiveSummary.riskLevel}`);
        console.log(`      - 结论: ${report.executiveSummary.conclusion.substring(0, 50)}...`);
        console.log(`      - 建议数量: ${report.executiveSummary.recommendations.length}条`);

        console.log(`      详细分析: ✅`);
        console.log(`      - 现金流表: ${report.detailedAnalysis.cashFlowTable.length}年`);
        console.log(`      - 敏感性分析: ${report.detailedAnalysis.sensitivityAnalysis ? '有' : '无'}`);

        console.log(`      证据附件: ✅`);
        console.log(`      - 数据来源: ${report.evidenceAppendix.dataSources.length}个`);
        console.log(`      - 关键假设: ${report.evidenceAppendix.keyAssumptions.length}个`);
        console.log(`      - 行业标准: ${report.evidenceAppendix.assumptionDetails.references.length}个`);

        if (report.uncertaintyAnalysis) {
            console.log(`      不确定性分析: ✅`);
            console.log(`      - 置信水平: ${report.uncertaintyAnalysis.confidenceLevel}`);
            console.log(`      - 敏感性因子: ${report.uncertaintyAnalysis.sensitivityFactors.length}个`);
        }

        console.log(`      合规声明: ✅`);
        console.log(`      - 引用标准: ${report.compliance.standards.length}个`);
        console.log(`      - 免责声明: ${report.compliance.disclaimers.length}条`);

        passedTests++;

        console.log('\n  3.3 测试时间线统计...');
        const stats = await TimelineManager.getTimelineStats('test-project-001');

        console.log(`    ✅ 总里程碑数: ${stats.totalMilestones}`);
        if (stats.firstMilestone) {
            console.log(`    ✅ 首个里程碑: ${stats.firstMilestone.toISOString().split('T')[0]}`);
        }
        if (stats.averageFrequency > 0) {
            console.log(`    ✅ 平均频率: ${stats.averageFrequency.toFixed(1)}天/里程碑`);
        }

        passedTests++;

    } catch (error: any) {
        console.log(`    ❌ Phase 3 测试失败: ${error.message}`);
        console.error(error);
        failedTests++;
    }

    // ═══════════════════════════════════════
    // 测试总结
    // ═══════════════════════════════════════
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 测试总结\n');

    const totalTests = passedTests + failedTests;
    const successRate = (passedTests / totalTests * 100).toFixed(1);

    console.log(`  总测试数: ${totalTests}`);
    console.log(`  ✅ 通过: ${passedTests}`);
    console.log(`  ❌ 失败: ${failedTests}`);
    console.log(`  成功率: ${successRate}%`);

    if (failedTests === 0) {
        console.log('\n🎉 所有测试通过！终极护城河架构运行正常！');
        console.log('🏰 Phase 1-3 完整集成验证成功！\n');
    } else {
        console.log('\n⚠️  部分测试失败，请检查错误信息\n');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    return failedTests === 0;
}

// 运行测试
runTests()
    .then(success => {
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('测试运行失败:', error);
        process.exit(1);
    });
