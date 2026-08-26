// 运维模块类型定义

export interface PRAnaInput {
    lat: number;
    lng: number;
    capacity: number; // kWp
    actualGeneration: number; // kWh
    startDate: string; // YYYYMMDD
    endDate: string; // YYYYMMDD
    panelType?: 'mono' | 'poly' | 'thin-film';
    installMethod?: 'fixed' | 'tracking';
    tilt?: number;
    azimuth?: number;
}

export interface PRAnalysisReport {
    stationInfo: {
        location: string;
        capacity: number;
        period: string;
        yearsInService: number;
    };
    meteoData: {
        totalRadiation: number; // kWh/m2
        avgRadiation: number; // kWh/m2/day
        avgTemp: number; // °C
        peakSunHours: number; // h
    };
    performance: {
        theoreticalGen: number; // kWh
        actualGen: number; // kWh
        pr: number; // 0-1
        benchmarkPr: number; // 0-1
        deviation: number;
        specificYield: number; // kWh/kWp
        equivalentHours: number; // h
    };
    diagnostics: Array<{
        reason: string;
        probability: number;
        evidence: string;
        impact: string;
        verification: string;
        action: string;
    }>;
    trends?: any;
    economicLoss: {
        monthlyLossGen: number;
        monthlyLossRevenue: number;
        annualLossRevenue: number;
    };
    actionList: string[];
}

export interface CleaningDecisionInput {
    lat: number;
    lng: number;
    capacity: number;
    lastCleaningDate: string; // YYYY-MM-DD
    tilt?: number;
    cleaningCostPerKw?: number;
}

export interface CleaningDecision {
    soilingAssessment: {
        lastCleaningDays: number;
        effectiveSoilingDays: number;
        avgPm25: number;
        tilt: number;
        estimatedLoss: number; // percentage
    };
    economicAnalysis: {
        currentDailyGen: number;
        estimatedDailyGenAfterCleaning: number;
        dailyGain: number;
        monthlyGain: number;
        monthlyRevenueGain: number;
        cleaningCost: number;
        downtimeLoss: number;
        totalCost: number;
    };
    recommendation: {
        shouldClean: boolean;
        reason: string;
        bestWindow: {
            date: string;
            time: string;
            weather: string;
            temp: string;
        };
        avoidDates: string[];
    };
    proTips: string[];
}

export interface InverterDiagnosisInput {
    brand?: string;
    model?: string;
    errorCode?: string;
    symptoms?: string;
    imageUrls?: string[];
}

export interface InverterDiagnosis {
    deviceInfo: {
        brand: string;
        model: string;
        errorCode: string;
        description: string;
    };
    analysis: {
        primaryReason: {
            reason: string;
            probability: number;
            evidence: string;
            danger: string;
        };
        secondaryReasons: Array<{
            reason: string;
            probability: number;
            symptoms: string;
        }>;
    };
    safetyWarning: string[];
    repairSteps: Array<{
        step: string;
        description: string;
        order: number;
    }>;
    prevention: string[];
    references: string[];
}

export interface StringAnalysisInput {
    invName: string;
    strings: Array<{
        id: string;
        voltage: number;
        current: number;
        power: number;
    }>;
}

export interface StringAnalysis {
    summary: {
        invName: string;
        timestamp: string;
        avgPower: number;
        stdDev: number;
    };
    stringResults: Array<{
        id: string;
        v: number;
        a: number;
        w: number;
        status: 'normal' | 'error' | 'warning';
    }>;
    diagnostics: Array<{
        stringId: string;
        severity: 'high' | 'medium';
        type: string;
        reasons: string[];
        actions: string[];
    }>;
    lossEstimate: {
        dailyLossWatts: number;
        dailyLossKwh: number;
        monthlyLossRevenue: number;
    };
}

export interface IVAnalysisInput {
    voc_nom: number;
    isc_nom: number;
    vmp_nom: number;
    imp_nom: number;
    pmax_nom: number;
    voc_meas: number;
    isc_meas: number;
    vmp_meas: number;
    imp_meas: number;
    pmax_meas: number;
    irradiance: number;
    temperature: number;
    moduleModel?: string;
}

export interface IVAnalysis {
    condition: {
        timestamp: string;
        irradiance: number;
        temperature: number;
        model: string;
    };
    comparison: Array<{
        param: string;
        nominal: number;
        measured: number;
        deviation: number;
    }>;
    ff: {
        nominal: number;
        measured: number;
        deviation: number;
    };
    morphologyAnalysis: string;
    diagnosis: {
        conclusion: string;
        detailedAnalysis: string[];
        reasons: string[];
    };
    economicDecision: {
        action: string;
        reasoning: string;
        recoveryEstimate: string;
    };
}

export interface WorkPermitInput {
    type: 'cleaning' | 'inverter' | 'cable' | 'general' | 'emergency';
    stationName: string;
    location: string;
    planDate: string;
    staffCount: number;
}

export interface WorkPermit {
    header: {
        id: string;
        type: string;
        group: string;
        issuedAt: string;
    };
    content: {
        tasks: string[];
        location: string;
        timeframe: string;
    };
    safety: {
        riskPoints: Array<{
            point: string;
            control: string;
        }>;
        tools: {
            electrical: string[];
            mechanical: string[];
            safety: string[];
        };
    };
    steps: string[];
    acceptance: string[];
}

export interface MaintenancePlan {
    stationInfo: {
        name: string;
        commissionDate: string;
        serviceLifespan: string;
    };
    assessments: Array<{
        component: string;
        status: string;
        remainingLife: string;
        recommendation: string;
    }>;
    calendar: Array<{
        month: string;
        tasks: string[];
    }>;
    budgetEstimate: {
        total: number;
        breakdown: Array<{
            item: string;
            cost: number;
        }>;
        benchmark: string;
    };
}

export interface WindDiagnosisInput {
    system: 'pitch' | 'gearbox' | 'generator' | 'converter' | 'yaw' | 'other';
    errorCode?: string;
    symptoms?: string;
}
