"""
NASA POWER API 服务
获取全球太阳能资源数据
"""
import httpx
from typing import Optional, List, Dict, Union

from app.services.overseas_gate import refuse_if_cn


class NASAPowerService:
    """NASA POWER API 服务"""
    
    BASE_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
    
    async def get_solar_resource(self, lat: float, lon: float) -> dict:
        """
        获取指定坐标的太阳能资源数据
        
        Args:
            lat: 纬度
            lon: 经度
        
        Returns:
            包含GHI、DNI、DHI等数据的字典
        """
        from app.services import overseas_gate
        if (overseas_gate.settings.APP_EDITION or "").lower() == "cn":
            from app.services.domestic_resource import nasa_shaped
            return nasa_shaped(lat, lon)
        refuse_if_cn()
        params = {
            "parameters": "ALLSKY_SFC_SW_DWN",  # GHI
            "community": "RE",  # Renewable Energy
            "longitude": lon,
            "latitude": lat,
            "start": "20200101",
            "end": "20231231",
            "format": "JSON"
        }
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(self.BASE_URL, params=params)
                response.raise_for_status()
                data = response.json()
                
                # 解析数据
                ghi_data = data.get("properties", {}).get("parameter", {}).get("ALLSKY_SFC_SW_DWN", {})
                
                if ghi_data:
                    # 计算年均值
                    # ALLSKY_SFC_SW_DWN（daily 接口）单位已是 kWh/m²/day；-999 为缺测填充值。
                    # 日均 × 365 即年累计 kWh/m²，不能再 ÷1000（此前结果约 1.6 而非 ~1600）。
                    daily_values = [v for v in ghi_data.values() if isinstance(v, (int, float)) and v >= 0]
                    if not daily_values:
                        raise RuntimeError("NASA POWER returned no valid solar observations")
                    annual_ghi = sum(daily_values) / len(daily_values) * 365
                    
                    return {
                        "ghi_annual": round(annual_ghi, 1),
                        "dni_annual": round(annual_ghi * 0.6, 1),  # 估算DNI
                        "dhi_annual": round(annual_ghi * 0.4, 1),  # 估算DHI
                        "temp_avg": 15.0,  # 默认值
                        "data_source": "NASA POWER MERRA-2",
                        "data_period": "2020-2023",
                    }
                
                raise RuntimeError("NASA POWER returned no valid solar observations")
                
        except Exception as exc:
            raise RuntimeError("NASA POWER solar resource data is currently unavailable") from exc


async def assess_solar_resource(lat: float, lon: float) -> dict:
    """评估太阳能资源（便捷函数）"""
    service = NASAPowerService()
    return await service.get_solar_resource(lat, lon)
