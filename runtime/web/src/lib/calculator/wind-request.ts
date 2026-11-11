/** 风电测算页提交的请求体。lat/lng/name/province 用选点之后的值，不另写一套默认坐标。 */

export interface WindDraft {
    lat: number;
    lng: number;
    name: string;
    province: string;
    turbineType: string;
    capacity: number;
    count: number;
    hubHeight: number;
    rotorDiameter: number;
    businessMode: string;
    cooperationMode: string;
    unitCost: number;
}

export function windRequestBody(form: WindDraft, feedInTariff: string) {
    return {
        lat: form.lat,
        lng: form.lng,
        name: form.name,
        province: form.province,
        turbineType: form.turbineType,
        capacity: form.capacity,
        count: form.count,
        hubHeight: form.hubHeight,
        rotorDiameter: form.rotorDiameter,
        businessMode: form.businessMode,
        cooperationMode: form.cooperationMode,
        unitCost: form.unitCost,
        turbine: {
            type: form.turbineType,
            capacity: form.capacity,
            count: form.count,
            hubHeight: form.hubHeight,
            rotorDiameter: form.rotorDiameter,
            cutInSpeed: 3.0,
            ratedSpeed: 10.5,
            cutOutSpeed: 25.0,
        },
        businessModel: {
            mode: form.businessMode,
            cooperationMode: form.cooperationMode,
            ...(feedInTariff.trim() ? { feedInTariff: Number(feedInTariff) } : {}),
        },
        investment: { unitCost: form.unitCost },
        operation: {},
    };
}
