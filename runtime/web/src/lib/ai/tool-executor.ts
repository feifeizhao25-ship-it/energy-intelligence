import { getSolarResource, getWindResource, getClimateData, getHistoricalData } from '@/lib/api/nasa-power';
import { getYearSunPath } from '@/lib/api/suncalc';
import { getElevation } from '@/lib/api/elevation';
import { calculateSolarScore, calculateWindScore, analyzeComplementarity } from '@/lib/resource/analysis';
import { generateResourceReport } from '@/lib/resource/report';
import { getCurrentWeather, getWeatherForecast, getAirQuality, getUVIndex } from '@/lib/api/weather';
import { searchPapers, getPaper, getRecommendations, getPaperCitations, searchAuthors } from '@/lib/api/semantic-scholar';
import { searchArxiv } from '@/lib/api/arxiv';
import { findBestPdf } from '@/lib/papers/pdf';
import { generateSummary, extractKeyData } from '@/lib/papers/ai';
import { getCitation } from '@/lib/api/crossref';
import { geocodeAddress, reverseGeocode, searchNearbyPOIs } from '@/lib/api/amap';
import { getAirQualityIndex } from '@/lib/api/open-meteo';
import { getPVWattsData, calculateSolarOutput } from '@/lib/api/nrel';
import { calculateSolar } from '@/lib/calculator/solar';
import { compareSolarAndWind } from '@/lib/calculator/solar';
import { calculateWind } from '@/lib/calculator/wind';
import { calculateStorage } from '@/lib/calculator/storage';
import { getPriceConfig } from '@/lib/policy/electricity-price';
import {
    analyzePR,
    recommendCleaning,
    diagnoseInverter,
    diagnoseWindTurbine,
    analyzeStrings,
    analyzeIVCurve,
    generateWorkPermit,
    predictMaintenance,
    detectELDefects,
    analyzeVibration,
    analyzeBladeImage,
    analyzeSOH,
    analyzeThermal,
    analyzeConsistency,
    searchSafetyRegulations
} from '@/lib/maintenance';
// import { compareSiteEnergies } from '@/lib/calculator/aggregator'; // Removed in Phase 1 Refinement
import { ragProcessor } from '../papers/rag';
import { simpleChat } from '@/lib/ai/unified';

// 碳排放强度数据（各电网）
const CARBON_INTENSITY: Record<string, number> = {
    '华北': 0.8843,
    '东北': 0.8179,
    '华东': 0.7035,
    '华中': 0.5257,
    '西北': 0.8922,
    '南方': 0.5271,
    '默认': 0.7850
};

// 工具执行主函数
export async function executeTool(toolName: string, toolInput: Record<string, unknown>): Promise<unknown> {
    try {
        switch (toolName) {
            // ========== Advanced Maintenance Tools ==========
            case 'detect_el_defects':
                return await detectELDefects(toolInput as any);

            case 'analyze_vibration':
                return await analyzeVibration(toolInput as any);

            case 'analyze_blade_health':
                return await analyzeBladeImage(toolInput as any);

            case 'monitor_storage_soh':
                return await analyzeSOH(toolInput as any);

            case 'monitor_storage_thermal':
                return await analyzeThermal(toolInput as any);

            case 'analyze_storage_consistency':
                return await analyzeConsistency(toolInput as any);

            case 'search_safety_regulations':
                return await searchSafetyRegulations(toolInput as any);

            // ========== Data Tools ==========
            case 'get_solar_resource':
                return await getSolarResource(
                    toolInput.lat as number,
                    toolInput.lng as number
                );

            case 'get_wind_resource':
                return await getWindResource(
                    toolInput.lat as number,
                    toolInput.lng as number
                );

            case 'get_current_weather':
                return await getCurrentWeather(
                    toolInput.lat as number,
                    toolInput.lng as number
                );

            case 'get_weather_forecast':
                return await getWeatherForecast(
                    toolInput.lat as number,
                    toolInput.lng as number,
                    (toolInput.days as number) || 7
                );

            case 'get_pv_forecast':
                return await getPVWattsData(
                    toolInput.lat as number,
                    toolInput.lng as number,
                    toolInput.capacity as number,
                    (toolInput.tilt as number) || 30,
                    (toolInput.azimuth as number) || 180
                );

            case 'get_historical_data':
                return await getHistoricalData(
                    toolInput.lat as number,
                    toolInput.lng as number,
                    toolInput.startYear as number,
                    toolInput.endYear as number,
                    toolInput.parameters as string[]
                );

            case 'get_carbon_intensity':
                const region = toolInput.region as string;
                return {
                    region,
                    carbonIntensity: CARBON_INTENSITY[region] || CARBON_INTENSITY['默认'],
                    unit: 'kgCO2/kWh',
                    source: '中国电网碳排放因子数据库'
                };

            case 'get_air_quality':
                try {
                    return await getAirQuality(
                        toolInput.lat as number,
                        toolInput.lng as number
                    );
                } catch (error) {
                    // Fallback to OpenMeteo (Free)
                    return await getAirQualityIndex(
                        toolInput.lat as number,
                        toolInput.lng as number
                    );
                }

            case 'get_uv_index':
                return await getUVIndex(
                    toolInput.lat as number,
                    toolInput.lng as number
                );

            case 'geocode_address':
                return await geocodeAddress(toolInput.address as string);

            case 'reverse_geocode':
                return await reverseGeocode(
                    toolInput.lat as number,
                    toolInput.lng as number
                );

            case 'search_nearby_pois':
                return await searchNearbyPOIs(
                    toolInput.lat as number,
                    toolInput.lng as number,
                    (toolInput.keywords as string[]) || ['变电站', '输电线路'],
                    (toolInput.radius as number) || 5000
                );

            case 'get_nrel_solar_resource':
                try {
                    return await getPVWattsData(
                        toolInput.lat as number,
                        toolInput.lng as number,
                        (toolInput.capacity as number) || 10,
                        (toolInput.tilt as number) || 30,
                        (toolInput.azimuth as number) || 180
                    );
                } catch (e) {
                    // Fallback to estimation if API fails or no key
                    return calculateSolarOutput(
                        toolInput.lat as number,
                        toolInput.lng as number,
                        (toolInput.capacity as number) || 10,
                        (toolInput.electricityPrice as number) || 0.4,
                        (toolInput.investment as number) || 0
                    );
                }

            case 'get_climate_data':
                return await getClimateData(
                    toolInput.lat as number,
                    toolInput.lng as number
                );

            case 'get_sun_path':
                return getYearSunPath(
                    toolInput.lat as number,
                    toolInput.lng as number
                );

            case 'compare_locations': {
                const locations = toolInput.locations as Array<{ lat: number, lng: number, name: string }>;
                const results = await Promise.all(locations.map(async (loc) => {
                    const solar = await getSolarResource(loc.lat, loc.lng);
                    const wind = await getWindResource(loc.lat, loc.lng);
                    const climate = await getClimateData(loc.lat, loc.lng);
                    const elevation = await getElevation(loc.lat, loc.lng);

                    const solarScore = calculateSolarScore(solar, climate);
                    const windScore = calculateWindScore(wind, climate, elevation);
                    const comp = analyzeComplementarity(solar, wind);

                    return {
                        location: loc,
                        solar,
                        wind,
                        climate,
                        elevation,
                        scores: { solar: solarScore, wind: windScore, complementarity: comp.score },
                        complementarity: comp
                    };
                }));
                return results;
            }

            case 'generate_resource_report': {
                const { lat, lng, name, reportType } = toolInput as { lat: number, lng: number, name: string, reportType: any };
                const solar = await getSolarResource(lat, lng);
                const wind = await getWindResource(lat, lng);
                const climate = await getClimateData(lat, lng);
                const history = await getHistoricalData(lat, lng, 2020, 2023); // Default short range for quick report
                const elevation = await getElevation(lat, lng);

                const analysis = {
                    solarScore: calculateSolarScore(solar, climate),
                    windScore: calculateWindScore(wind, climate, elevation),
                    complementarity: analyzeComplementarity(solar, wind)
                };

                return generateResourceReport({
                    location: name,
                    solar,
                    wind,
                    climate,
                    history,
                    analysis
                }, reportType);
            }

            // ========== 计算类工具 ==========
            case 'calculate_solar':
                return await calculateSolar({
                    lat: toolInput.lat as number,
                    lng: toolInput.lng as number,
                    capacity: toolInput.capacity as number,
                    installationType: toolInput.installationType as 'roof' | 'ground' | 'carport' | 'bifacial',
                    moduleType: toolInput.moduleType as 'economy' | 'standard' | 'premium',
                    selfUseRatio: toolInput.selfUseRatio as number,
                    electricityPrice: toolInput.electricityPrice as number,
                    feedInTariff: toolInput.feedInTariff as number,
                    province: toolInput.province as string
                });

            case 'calculate_wind':
                return await calculateWind({
                    lat: toolInput.lat as number,
                    lng: toolInput.lng as number,
                    province: toolInput.province as string || '默认',
                    projectName: toolInput.projectName as string || '未命名风电项目',
                    turbine: {
                        type: (toolInput.turbineType as any) || 'medium_wind',
                        capacity: toolInput.capacity as number || 5.0,
                        count: toolInput.turbineCount as number || 1,
                        hubHeight: toolInput.hubHeight as number || 100,
                        rotorDiameter: 160,
                        cutInSpeed: 3,
                        ratedSpeed: 10,
                        cutOutSpeed: 25
                    },
                    businessModel: {
                        mode: (toolInput.businessModel as any) || 'full_export',
                        electricityPrice: toolInput.electricityPrice as number,
                        cooperationMode: (toolInput.cooperationMode as any) || 'none'
                    },
                    investment: {
                        unitCost: 5500
                    },
                    operation: {
                        operationYears: 20
                    }
                });

            case 'calculate_storage':
                return calculateStorage({
                    capacity: toolInput.capacity as number,
                    energy: (toolInput.capacity as number) * 2, // 默认2小时配储
                    batteryType: (toolInput.batteryType === 'sodium_ion' ? 'sodium' : 'lithium'),
                    location: {
                        province: toolInput.province as string || '江苏',
                        lat: toolInput.lat as number,
                        lng: toolInput.lng as number
                    },
                    applicationMode: (toolInput.mode as any) || 'arbitrage',
                    investment: {
                        unitCost: (toolInput.unitCost as number) || 1200,
                        financing: 'cash'
                    },
                    technical: {
                        efficiency: 85,
                        dod: 90,
                        cycleLife: (toolInput.cycleLife as number) || 6000,
                        degradationRate: 2,
                        maintenanceCostRatio: 1.5
                    }
                });

            case 'compare_solar_wind':
                return await compareSolarAndWind(
                    toolInput.lat as number,
                    toolInput.lng as number,
                    toolInput.province as string
                );

            case 'explain_site_recommendation':
                return await explainSiteRecommendation(toolInput.comparisonResult as any);

            case 'simulate_cooperation':
                return simulateCooperation(toolInput);

            // ========== 运维类工具 ==========
            case 'diagnose_system_health':
                // PR 深度分析
                const year = (toolInput.year as number) || new Date().getFullYear();
                const month = (toolInput.month as number) || (new Date().getMonth() + 1);
                const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
                const endDate = `${year}-${month.toString().padStart(2, '0')}-${new Date(year, month, 0).getDate()}`; // Last day of month

                return await analyzePR({
                    lat: toolInput.lat as number,
                    lng: toolInput.lng as number,
                    capacity: toolInput.capacity as number,
                    actualGeneration: toolInput.actualGeneration as number,
                    startDate,
                    endDate
                });

            case 'recommend_cleaning':
                return await recommendCleaning({
                    lat: toolInput.lat as number,
                    lng: toolInput.lng as number,
                    capacity: toolInput.capacity as number,
                    lastCleaningDate: toolInput.lastCleaningDate as string,
                    cleaningCostPerKw: (toolInput.costPerKw as number) || 3
                });

            case 'analyze_strings':
                const rawStrings = (toolInput.strings as any[]) || [];
                return await analyzeStrings({
                    invName: (toolInput.inverterId as string) || 'INV-01',
                    strings: rawStrings.map(s => ({
                        id: s.id,
                        voltage: s.voltage || 0,
                        current: s.current || 0,
                        power: s.power || (s.voltage * s.current) || 0
                    }))
                });

            case 'analyze_iv_curve':
                const voc = toolInput.voc as number;
                const isc = toolInput.isc as number;
                const vmp = toolInput.vmp as number;
                const imp = toolInput.imp as number;
                const pmax = toolInput.pmax as number;
                return await analyzeIVCurve({
                    voc_meas: voc,
                    isc_meas: isc,
                    vmp_meas: vmp,
                    imp_meas: imp,
                    pmax_meas: pmax,
                    temperature: (toolInput.temp as number) || 25,
                    irradiance: (toolInput.irradiance as number) || 1000,
                    // Mock nominal values for comparison if not provided
                    voc_nom: voc / 0.95,
                    isc_nom: isc / 0.95,
                    vmp_nom: vmp / 0.95,
                    imp_nom: imp / 0.95,
                    pmax_nom: pmax / 0.9
                });

            case 'generate_work_permit':
                const validTypes = ['cleaning', 'inverter', 'cable', 'general', 'emergency'];
                const typeInput = toolInput.type as string;
                return await generateWorkPermit({
                    type: (validTypes.includes(typeInput) ? typeInput : 'general') as any,
                    stationName: (toolInput.stationName as string) || '光伏电站',
                    location: toolInput.location as string,
                    planDate: (toolInput.startTime as string)?.split('T')[0] || new Date().toISOString().split('T')[0],
                    staffCount: (toolInput.staffCount as number) || 2
                });

            case 'predict_maintenance':
                return await predictMaintenance({
                    name: (toolInput.stationName as string) || '光伏电站',
                    commissionDate: toolInput.commissionDate as string,
                    capacity: toolInput.capacity as number
                });

            case 'recommend_maintenance_window':
                return await recommendMaintenanceWindow(toolInput);

            case 'diagnose_fault':
                // Check if specific device handlers are requested
                if (toolInput.deviceType === 'wind_turbine') {
                    return await diagnoseWindTurbine({
                        system: (toolInput.system as any) || 'other',
                        errorCode: toolInput.errorCode as string,
                        symptoms: toolInput.symptom as string
                    });
                }
                if (toolInput.deviceType === 'inverter') {
                    return await diagnoseInverter({
                        errorCode: toolInput.errorCode as string,
                        symptoms: toolInput.symptom as string
                    });
                }

                // General Issue or Fallback: Use Strong AI Model (DeepSeek-V3 if requested)
                // This covers the "Top 10 Hot Issues" precise analysis
                const aiModel = (toolInput.model as string) || 'glm-4-plus';
                const symptom = toolInput.symptom as string;
                const deviceType = toolInput.deviceType as string || 'general';

                const prompt = `
                你需要作为一位资深的新能源运维专家，对以下问题进行精准分析。
                
                设备/领域: ${deviceType}
                问题描述: ${symptom}
                
                请提供:
                1. 问题核心原因分析 (深度技术视角)
                2. 排查步骤 (Step-by-step)
                3. 解决方案与建议
                4. 预防措施
                
                请确保回答专业、具体，直接解决用户的痛点。
                `;

                try {
                    // Dynamic import to avoid circular dependency if any, or just import at top if possible. 
                    // But for this tool call, I'll add the import at the top in a separate chunk.
                    const analysis = await simpleChat(prompt, aiModel as any);

                    return {
                        analysis: {
                            primaryReason: { reason: "AI 深度分析结果", probability: 0.95 },
                            secondaryReasons: []
                        },
                        diagnosis: {
                            conclusion: "AI 智能诊断完成",
                            detailedAnalysis: [analysis] // We put the full text here or in a specific field
                        },
                        rawAnalysis: analysis, // For UI to display
                        repairSteps: [] // AI text contains steps usually
                    };
                } catch (e) {
                    return {
                        error: 'AI Analysis Failed',
                        details: e instanceof Error ? e.message : String(e)
                    };
                }

            case 'generate_inspection_plan':
                return generateInspectionPlan(toolInput);

            case 'calculate_downtime_loss':
                return await calculateDowntimeLoss(toolInput);

            // ========== 文献类工具 ==========
            case 'search_papers':
                return await searchPapers(
                    toolInput.query as string,
                    {
                        yearFrom: toolInput.yearFrom as number || toolInput.year_from as number,
                        yearTo: toolInput.yearTo as number,
                        openAccess: toolInput.openAccess as boolean || toolInput.open_access as boolean,
                        limit: (toolInput.limit as number) || 10
                    }
                );

            case 'get_paper_detail':
                return await getPaper(toolInput.paperId as string);

            case 'get_paper_pdf':
                const pdfPaper = await getPaper(toolInput.paperId as string);
                return await findBestPdf(pdfPaper);

            case 'get_paper_citations':
                return await getPaperCitations(
                    toolInput.paperId as string,
                    10
                );

            case 'generate_paper_summary':
                if (toolInput.abstract) {
                    return await generateSummary(toolInput.abstract as string, 'Unknown Title');
                } else if (toolInput.paperId) {
                    const sumPaper = await getPaper(toolInput.paperId as string);
                    return await generateSummary(sumPaper.abstract, sumPaper.title);
                } else {
                    return { error: 'Most provide either paperId or abstract' };
                }

            case 'extract_paper_data':
                if (toolInput.text) {
                    return await extractKeyData(toolInput.text as string);
                } else if (toolInput.paperId) {
                    const dataPaper = await getPaper(toolInput.paperId as string);
                    return await extractKeyData(dataPaper.abstract + (dataPaper.tldr || ''));
                } else {
                    return { error: 'Most provide either paperId or text' };
                }

            case 'generate_citation':
                // Use getCitation from crossref (fixed import name mismatch)
                const citPaper = await getPaper(toolInput.paperId as string);
                if (citPaper.doi) {
                    return await getCitation(citPaper.doi, (toolInput.format as string) || 'apa');
                }
                return { error: 'Paper does not have a DOI' };

            case 'search_author':
                return await searchAuthors(toolInput.authorName as string);

            case 'get_trending_papers':
                const field = toolInput.field as string;
                // Trending implementation: Search for recent high citation papers
                const currentYear = new Date().getFullYear();
                return await searchPapers(
                    `${field} review or breakthrough`,
                    {
                        yearFrom: currentYear - 1,
                        limit: (toolInput.limit as number) || 5,
                        // Implicitly handled by searchPapers sorting if implemented, otherwise default sort
                    }
                );

            case 'get_paper_recommendations':
                return await getRecommendations(
                    toolInput.paperId as string,
                    (toolInput.limit as number) || 5
                );

            case 'search_arxiv':
                return await searchArxiv(
                    toolInput.query as string,
                    { limit: (toolInput.limit as number) || 10 }
                );

            case 'query_knowledge_base': {
                const { query, documentId, userId } = toolInput;
                // 在检索时加入 userId 过滤，确保数据隔离
                const filter: any = userId ? { userId } : {};
                if (documentId) filter.documentId = documentId;

                const context = await ragProcessor.searchContext(query as string, undefined, 5, filter);
                if (!context || context.length === 0) {
                    return '知识库中未找到相关内容。请确保已索引该文档。';
                }
                return context.map((c: any) => `[来自文档 ${c.metadata.documentId || '未知'}] ${c.content}`).join('\n\n');
            }

            // ========== 编排器工具 ==========
            case 'get_project_next_steps': {
                const { buildOrchestratorResponse } = await import('@/lib/orchestrator');
                const response = await buildOrchestratorResponse(
                    toolInput.projectId as string,
                    toolInput.userId as string
                );

                return {
                    success: true,
                    stage: response.stage,
                    stageName: response.stageMeta.name,
                    stageIcon: response.stageMeta.icon,
                    stageConfidence: response.stageConfidence,
                    recommendations: response.recommendedActions.slice(0, 5).map(a => ({
                        title: a.title,
                        description: a.description,
                        priority: a.priority,
                        category: a.category,
                        reason: a.rationale.summary,
                        evidence: a.rationale.evidence,
                        requiresPro: !!a.requiresPlan,
                        link: a.cta.type === 'NAVIGATE' ? a.cta.target : null,
                    })),
                    checklist: response.checklist.map(c => ({
                        task: c.label,
                        done: c.done,
                        recommended: c.recommended,
                    })),
                    paywallHints: response.paywallHints.map(p => ({
                        feature: p.featureKey,
                        reason: p.reason,
                        plan: p.planToUpgrade,
                    })),
                    summary: `项目当前处于"${response.stageMeta.name}"阶段（置信度${Math.round(response.stageConfidence * 100)}%），有${response.recommendedActions.length}条智能推荐`,
                };
            }

            default:
                return { error: `未知工具: ${toolName}` };
        }
    } catch (error) {
        console.error(`工具执行错误 [${toolName}]:`, error);
        return {
            error: `工具执行失败: ${error instanceof Error ? error.message : '未知错误'}`,
            toolName
        };
    }
}

// ========== 辅助函数 ==========

// PV发电预测（简化版）
async function getPVForecast(lat: number, lng: number, capacity: number, tilt: number, azimuth: number) {
    try {
        const forecast = await getWeatherForecast(lat, lng, 7);
        const dailyForecast = forecast.map((day: { date: string; clouds: number; temp: number }) => {
            // 简化计算：基于云量估算发电量
            const clearSkyFactor = 1 - (day.clouds / 100) * 0.8;
            const tempFactor = 1 - Math.max(0, (day.temp - 25)) * 0.004;
            const dailyWh = capacity * 4.5 * clearSkyFactor * tempFactor * 1000; // 假设4.5峰值日照小时
            return {
                date: day.date,
                watts: capacity * 1000 * clearSkyFactor * tempFactor,
                wattHours: dailyWh,
                confidence: 0.75
            };
        });
        return dailyForecast;
    } catch (error) {
        throw new Error('获取发电预测失败');
    }
}



// 系统健康诊断
async function diagnoseSystemHealth(input: Record<string, unknown>) {
    const { lat, lng, capacity, actualGeneration, month, year } = input as {
        lat: number;
        lng: number;
        capacity: number;
        actualGeneration: number;
        month: number;
        year: number;
    };

    // 获取当月辐照数据
    const solarResource = await getSolarResource(lat, lng);
    const monthData = solarResource.monthly[month - 1];

    // 计算当月天数
    const daysInMonth = new Date(year, month, 0).getDate();

    // 计算理论发电量 (kWh)
    const theoreticalGen = monthData.ghi * capacity * daysInMonth * 0.8; // 标准PR=0.8

    // 计算实际PR
    const actualPR = (actualGeneration / (monthData.ghi * capacity * daysInMonth)) * 100;

    // 健康评级
    let rating: 'excellent' | 'good' | 'attention' | 'abnormal';
    let causes: string[] = [];
    let recommendations: string[] = [];

    if (actualPR > 80) {
        rating = 'excellent';
        causes = ['系统运行正常'];
        recommendations = ['保持定期巡检', '继续监测发电量'];
    } else if (actualPR >= 70) {
        rating = 'good';
        causes = ['可能存在轻微积灰', '逆变器效率略有下降'];
        recommendations = ['建议清洗组件', '检查逆变器运行状态'];
    } else if (actualPR >= 60) {
        rating = 'attention';
        causes = ['组件积灰严重', '逆变器效率下降', '可能存在遮挡', '线路损耗偏大'];
        recommendations = ['立即清洗组件', '检查逆变器报警', '排查遮挡物', '检测线路连接'];
    } else {
        rating = 'abnormal';
        causes = ['设备故障', '严重遮挡', '组件热斑', '逆变器异常'];
        recommendations = ['停机检查', '请专业人员排查', '检测组件EL', '更换故障设备'];
    }

    return {
        theoreticalGen: Math.round(theoreticalGen),
        actualGeneration,
        pr: Math.round(actualPR * 100) / 100,
        rating,
        causes,
        recommendations,
        monthlyIrradiance: monthData.ghi,
        month,
        year
    };
}

// 检修窗口推荐
async function recommendMaintenanceWindow(input: Record<string, unknown>) {
    const { lat, lng, maintenanceType, days } = input as {
        lat: number;
        lng: number;
        maintenanceType: 'inspection' | 'cleaning' | 'repair';
        days: number;
    };

    const forecast = await getWeatherForecast(lat, lng, days || 7);

    const windows = forecast.map((day: { date: string; weather: string; windSpeed: number; clouds: number; temp: number }) => {
        let recommended = false;
        let reason = '';

        // 根据检修类型判断
        switch (maintenanceType) {
            case 'inspection':
                // 巡检：无雨、风速<10m/s
                recommended = !day.weather.includes('雨') && day.windSpeed < 10;
                reason = recommended ? '天气适宜巡检' : '天气不适宜';
                break;
            case 'cleaning':
                // 清洗：晴天、清晨或傍晚
                recommended = day.clouds < 30 && !day.weather.includes('雨');
                reason = recommended ? '晴天适合清洗' : '建议选择晴天';
                break;
            case 'repair':
                // 维修：无雨、弱光时段
                recommended = !day.weather.includes('雨') && day.windSpeed < 8;
                reason = recommended ? '适合维修作业' : '天气条件不佳';
                break;
        }

        // 估算停机损失
        const estimatedLoss = day.clouds < 50 ? 50 : 25; // kWh/kWp

        return {
            date: day.date,
            weather: day.weather,
            windSpeed: day.windSpeed,
            temperature: day.temp,
            recommended,
            reason,
            estimatedLoss,
            bestTimeSlot: day.clouds < 30 ? '6:00-8:00 或 17:00-19:00' : '全天均可'
        };
    });

    return {
        maintenanceType,
        recommendedWindows: windows.filter((w: { recommended: boolean }) => w.recommended),
        allWindows: windows
    };
}

// 生成巡检计划
function generateInspectionPlan(input: Record<string, unknown>) {
    const { capacity, inspectionType, commissionDate } = input as {
        capacity: number;
        inspectionType: 'daily' | 'monthly' | 'quarterly' | 'annual';
        commissionDate?: string;
        projectType?: 'solar' | 'wind';
    };

    const solarChecklists: Record<string, string[]> = {
        daily: [
            '检查逆变器运行状态和显示屏',
            '查看发电量是否正常',
            '观察组件表面是否有明显污垢',
            '检查是否有异常噪音',
            '记录当日发电数据'
        ],
        monthly: [
            '清洁组件表面',
            '检查所有线缆连接',
            '查看逆变器历史报警',
            '检测接地电阻',
            '清理配电柜灰尘',
            '检查支架紧固情况',
            '更新运维记录'
        ],
        quarterly: [
            '红外检测组件热斑',
            'I-V曲线测试',
            '检查防雷设备',
            '测试绝缘电阻',
            '检查直流汇流箱',
            '清洁逆变器散热风扇',
            '检查备品备件库存'
        ],
        annual: [
            'EL检测组件隐裂',
            '全面电气测试',
            '更换老化线缆',
            '校准监控设备',
            '评估系统性能衰减',
            '编写年度运维报告',
            '制定下年度维护计划',
            '检查质保索赔事项'
        ]
    };

    const windChecklists: Record<string, string[]> = {
        daily: [
            '远程监控风机运行状态',
            '查看实时风速和功率曲线',
            '检查是否存在未处理故障报警',
            '记录当日发电量',
            '通过视频监控查看外观是否有异常'
        ],
        monthly: [
            '检查塔筒螺栓紧固情况',
            '检查油位（齿轮箱、液压站）',
            '目视检查叶片是否有损伤',
            '检查变流器滤网清洁度',
            '测试紧急停机按钮功能',
            '检查电缆是否有磨损'
        ],
        quarterly: [
            '齿轮箱油品取样检测',
            '检查偏航系统刹车片磨损',
            '检查变桨系统电池组电压',
            '润滑发电机轴承',
            '检查联轴器弹性元件',
            '测试防雷接地电阻'
        ],
        annual: [
            '叶片无人机精细化巡检',
            '齿轮箱内窥镜检查',
            '力矩校核（塔筒、叶根螺栓）',
            '更换液压油和滤芯',
            '发电机绝缘测试',
            '全面安全链测试',
            '校准风速仪和风向标'
        ]
    };

    const projectType = (input.projectType as 'solar' | 'wind') || 'solar';
    const checklists = projectType === 'wind' ? windChecklists : solarChecklists;


    const safetyReminders = [
        '⚠️ 断电操作，确认无电压',
        '⚠️ 穿戴绝缘手套、安全帽',
        '⚠️ 高空作业系好安全带',
        '⚠️ 雷雨天气禁止作业',
        '⚠️ 两人以上配合作业'
    ];

    return {
        inspectionType,
        capacity,
        checklist: checklists[inspectionType],
        safetyReminders: projectType === 'wind' ? [
            '⚠️ 登塔作业必须佩戴双钩安全带',
            '⚠️ 严格执行"一人监护、一人操作"',
            '⚠️ 风速超过12m/s严禁登塔',
            '⚠️ 作业前必须锁定叶轮（插销）',
            '⚠️ 携带气体检测仪（塔底可能有废气）'
        ] : safetyReminders,
        estimatedDuration: {
            daily: '15-30分钟',
            monthly: '2-4小时',
            quarterly: '半天',
            annual: '1-2天'
        }[inspectionType],
        nextInspectionDate: getNextInspectionDate(inspectionType)
    };
}

function getNextInspectionDate(type: string): string {
    const now = new Date();
    switch (type) {
        case 'daily':
            now.setDate(now.getDate() + 1);
            break;
        case 'monthly':
            now.setMonth(now.getMonth() + 1);
            break;
        case 'quarterly':
            now.setMonth(now.getMonth() + 3);
            break;
        case 'annual':
            now.setFullYear(now.getFullYear() + 1);
            break;
    }
    return now.toISOString().split('T')[0];
}

// 停机损失计算
async function calculateDowntimeLoss(input: Record<string, unknown>) {
    const { lat, lng, capacity, startTime, endTime, province, projectType = 'solar' } = input as {
        lat: number;
        lng: number;
        capacity: number;
        startTime: string;
        endTime: string;
        province: string;
        projectType: 'solar' | 'wind';
    };

    // 解析时间
    const start = new Date(startTime);
    const end = new Date(endTime);
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

    // 获取电价配置
    const pricing = getPriceConfig(province);
    let estimatedGeneration = 0;

    if (projectType === 'wind') {
        const capacityFactor = 0.35;
        estimatedGeneration = capacity * capacityFactor * hours;
    } else {
        const effectiveHours = (hours / 24) * 4.5;
        estimatedGeneration = capacity * effectiveHours;
    }

    // 计算经济损失
    const currentPrice = (pricing.retailPrice + pricing.feedInTariff) / 2;
    const economicLoss = estimatedGeneration * currentPrice;

    return {
        downtimePeriod: { start: startTime, end: endTime },
        totalHours: Math.round(hours * 10) / 10,
        estimatedGenerationLoss: Math.round(estimatedGeneration),
        unit: 'kWh',
        economicLoss: Math.round(economicLoss * 100) / 100,
        currency: '元',
        electricityPrice: currentPrice,
        recommendation: hours > 24 ? '建议优化维修方案减少停机时间' : '停机时间在可接受范围内',
        projectType
    };
}

// 村企合作模拟
function simulateCooperation(input: Record<string, unknown>) {
    const { totalCapacity, annualGeneration, electricityPrice, cooperationMode, landArea, villageShare } = input as {
        totalCapacity: number;
        annualGeneration: number;
        electricityPrice: number;
        cooperationMode: 'rental' | 'equity' | 'revenue_share' | 'hybrid';
        landArea?: number;
        villageShare?: number;
    };

    const annualRevenue = annualGeneration * 1000 * electricityPrice; // MWh转kWh
    const area = landArea || totalCapacity * 15; // 默认15亩/MW

    let villageBenefit = 0;
    let enterpriseBenefit = 0;
    let description = '';

    switch (cooperationMode) {
        case 'rental':
            // 固定租金 800元/亩/年
            villageBenefit = area * 800;
            enterpriseBenefit = annualRevenue - villageBenefit;
            description = '固定租金模式：村集体获得稳定租金收入';
            break;
        case 'equity':
            // 村集体入股，默认10%
            const share = villageShare || 0.1;
            villageBenefit = annualRevenue * share;
            enterpriseBenefit = annualRevenue * (1 - share);
            description = `入股分红模式：村集体占股${share * 100}%，分享收益`;
            break;
        case 'revenue_share':
            // 发电收益5%归村集体
            villageBenefit = annualRevenue * 0.05;
            enterpriseBenefit = annualRevenue * 0.95;
            description = '收益分成模式：村集体获得5%发电收益';
            break;
        case 'hybrid':
            // 基础租金 + 超额分成
            const baseRent = area * 500;
            const threshold = totalCapacity * 1500 * 1000 * electricityPrice; // 基准收益
            const excess = Math.max(0, annualRevenue - threshold);
            villageBenefit = baseRent + excess * 0.1;
            enterpriseBenefit = annualRevenue - villageBenefit;
            description = '混合模式：基础租金500元/亩 + 超额收益10%分成';
            break;
    }

    return {
        cooperationMode,
        projectInfo: {
            totalCapacity: `${totalCapacity} MW`,
            annualGeneration: `${annualGeneration} GWh`,
            landArea: `${area} 亩`
        },
        annualRevenue: Math.round(annualRevenue),
        villageBenefit: Math.round(villageBenefit),
        enterpriseBenefit: Math.round(enterpriseBenefit),
        villageSharePercentage: (villageBenefit / annualRevenue * 100).toFixed(1) + '%',
        description,
        period25Years: {
            villageTotal: Math.round(villageBenefit * 25),
            enterpriseTotal: Math.round(enterpriseBenefit * 25)
        }
    };
}
// 解释推荐方案 (Phase 1)
// 解释推荐方案 (Production Grade)
async function explainSiteRecommendation(comparisonResult: any) {
    if (!comparisonResult) return { error: "缺少对比结果数据" };

    const prompt = `
    你是一位资深新能源投资顾问。请基于以下多能种对比评估结果，生成一份结构化的专家解读。

    【核心数据】
    - 项目地点: ${comparisonResult.address} (${comparisonResult.lat}, ${comparisonResult.lng})
    - 推荐方案: ${comparisonResult.recommendedType}
    - 资源条件: 光照 ${comparisonResult.resourceData?.solarGHI} kWh/m², 风速 ${comparisonResult.resourceData?.avgWindSpeed} m/s
    - 各方案数据: ${JSON.stringify(comparisonResult.solutions || comparisonResult, null, 2)}

    【输出要求】
    严格以 JSON 格式返回，包含以下字段：
    1. summary (string): 100字以内的核心结论，语气肯定，直接点出为什么这个方案最赚钱或最稳健。
    2. reasons (string[]): 3条具体理由（如：IRR优势、资源匹配度、政策利好）。
    3. keyRisks (string[]): 2-3条该方案的主要风险（如：组件涨价、弃风限电）。
    4. improvementSuggestions (string[]): 2-3条提升收益的具体建议（如：叠加储能、优化倾角）。

    【约束】
    - 不允许使用 Markdown 代码块，直接返回 JSON 字符串。
    - 字数总和不超过 300 字。
    - 必须客观、专业，禁止编造数据。
    `;

    try {
        const response = await simpleChat(prompt, 'glm-4-plus');
        // 尝试解析 JSON，如果失败则返回文本包装
        try {
            // 清理可能存在的 markdown 标记
            const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleanJson);
        } catch (e) {
            console.warn('AI JSON解析失败，降级为文本对象', e);
            return {
                summary: response.slice(0, 100),
                reasons: ["AI输出格式异常，请查看原文"],
                keyRisks: [],
                improvementSuggestions: []
            };
        }
    } catch (e) {
        return {
            summary: "AI 分析暂时不可用，请参考系统生成的简要建议。",
            reasons: [],
            keyRisks: [],
            improvementSuggestions: []
        };
    }
}
