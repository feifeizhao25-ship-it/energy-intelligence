// 简化的太阳轨迹计算 (SPA Lite)

interface SunPosition {
    azimuth: number; // 方位角 (度)
    altitude: number; // 高度角 (度)
}

interface SunTimes {
    sunrise: Date;
    sunset: Date;
    solarNoon: Date;
}

/**
 * 获取指定时间和位置的太阳位置
 * @param date 日期
 * @param lat 纬度
 * @param lng 经度
 */
export function getSunPosition(date: Date, lat: number, lng: number): SunPosition {
    const PI = Math.PI;
    const rad = PI / 180;
    const deg = 180 / PI;

    function toJulian(date: Date) {
        return date.valueOf() / 86400000 - 0.5 + 2440588;
    }

    const lw = rad * -lng;
    const phi = rad * lat;
    const d = toJulian(date) - 2451545;
    const m = (357.5291 + 0.98560028 * d) % 360;
    const c = (1.9148 * Math.sin(m * rad) + 0.0200 * Math.sin(2 * m * rad) + 0.0003 * Math.sin(3 * m * rad));
    const lam = (m + c + 180 + 102.9372) % 360;
    const eps = 23.4393 - 0.0000004 * d;
    const ra = Math.atan2(Math.cos(eps * rad) * Math.sin(lam * rad), Math.cos(lam * rad));
    const dec = Math.asin(Math.sin(eps * rad) * Math.sin(lam * rad));
    const siderealTime = (280.16 + 360.9856235 * d) % 360;
    const H = (siderealTime * rad - lw - ra);

    const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
    const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));

    return {
        altitude: alt * deg,
        azimuth: (az * deg + 180) % 360
    };
}

/**
 * 获取全年的太阳轨迹（用于绘图）
 */
export function getYearSunPath(lat: number, lng: number) {
    const dates = [
        new Date(new Date().getFullYear(), 2, 21), // 春分
        new Date(new Date().getFullYear(), 5, 22), // 夏至
        new Date(new Date().getFullYear(), 8, 23), // 秋分
        new Date(new Date().getFullYear(), 11, 22) // 冬至
    ];

    const paths = dates.map(date => {
        const path = [];
        for (let h = 4; h <= 20; h += 0.5) {
            const d = new Date(date);
            d.setHours(h, (h % 1) * 60, 0, 0);
            const pos = getSunPosition(d, lat, lng);
            if (pos.altitude > -5) {
                path.push({ hour: h, ...pos });
            }
        }
        return { date: date.toLocaleDateString(), path };
    });

    return paths;
}
