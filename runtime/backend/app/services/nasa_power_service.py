"""
NASA POWER API 服务
获取全球太阳能资源数据
"""
import httpx
from typing import Optional, List, Dict, Union


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
                    daily_values = list(ghi_data.values())
                    annual_ghi = sum(daily_values) / len(daily_values) * 365 / 1000  # 转换为kWh/m²
                    
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
