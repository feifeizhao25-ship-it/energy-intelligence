// Open-Elevation API 封装

export async function getElevation(lat: number, lng: number): Promise<number> {
    try {
        const url = `https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lng}`;
        const response = await fetch(url);

        if (!response.ok) {
            // Fallback to average elevation if API fails
            return 0;
        }

        const data = await response.json();
        return data.results?.[0]?.elevation || 0;
    } catch (e) {
        console.warn('Elevation API failed, returning 0');
        return 0;
    }
}
