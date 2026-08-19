
// Advanced Maintenance Types

export interface ELDetectInput {
    imageUrl?: string;
    description?: string;
    panelType?: string;
}

export interface ELDetectResult {
    summary: {
        defectCount: number;
        severity: 'low' | 'medium' | 'high';
        status: 'pass' | 'fail' | 'review';
    };
    defects: Array<{
        type: string; // 'crack', 'black_core', 'broken_gate'
        confidence: number;
        location: string;
        area: string;
        severity: 'low' | 'medium' | 'high';
        description: string;
    }>;
    recommendations: string[];
    originalImage: string;
    processedImage: string; // URL with bounding boxes
}

// Vibration Analysis
export interface VibrationInput {
    component: 'bearing' | 'gearbox' | 'generator';
    rpm: number;
    frequencySpectrum: number[]; // simple array for mock
    samplingRate?: number;
}

export interface VibrationResult {
    status: 'normal' | 'warning' | 'critical';
    dominantFrequencies: Array<{
        freq: number;
        amplitude: number;
        source: string; // 'inner_race', 'outer_race', 'cage', 'ball'
    }>;
    diagnosis: string;
    maintenanceAction: string;
}

// Blade Drone Inspection
export interface BladeDroneInput {
    imageUrl: string;
    turbineId?: string;
    bladeId?: string;
}

export interface BladeDroneResult {
    bladeId: string;
    damages: Array<{
        type: 'erosion' | 'crack' | 'lightning' | 'delamination';
        location: string; // e.g., 'Tip', 'Root', 'Mid-span'
        severity: number; // 1-5
        size: string;
    }>;
    riskLevel: 'low' | 'medium' | 'high';
    repairPlan: string;
}

// Storage SOH
export interface SohInput {
    batteryId: string;
    cycleCount: number;
    voltage: number;
    current: number;
    temperature: number;
    nominalCapacity: number;
}

export interface SohResult {
    soh: number; // 0-100
    remainingCycles: number;
    agingRate: string; // 'normal', 'accelerated'
    factors: string[]; // reasons for aging
}

// Storage Thermal
export interface ThermalInput {
    batteryPackId: string;
    temperatures: number[]; // array of cell temps
    ambientTemp: number;
    current: number;
}

export interface ThermalResult {
    maxTemp: number;
    minTemp: number;
    avgTemp: number;
    tempDiff: number;
    status: 'normal' | 'warning' | 'critical';
    runawayRisk: number; // 0-100%
    coolingAction: string;
}

// Storage Consistency
export interface StorageConsistencyInput {
    cellVoltages: number[];
    cellResistances?: number[];
}

export interface StorageConsistencyResult {
    consistencyLevel: 'A' | 'B' | 'C' | 'D'; // A is best
    voltageRange: number;
    abnormalCells: number[]; // indices
    balancingStatus: 'needed' | 'not_needed';
    balancingTimeEstimate: number; // minutes
}

// Safety Search
export interface SafetySearchInput {
    query: string;
    category?: 'solar' | 'wind' | 'storage' | 'electrical';
}

export interface SafetySearchResult {
    query: string;
    regulations: Array<{
        title: string;
        code: string; // e.g., GB/T 12345
        summary: string;
        relevance: number;
        link?: string;
    }>;
    procedures: Array<{
        name: string;
        steps: string[];
    }>;
}
