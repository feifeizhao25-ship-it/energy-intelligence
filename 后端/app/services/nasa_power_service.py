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
                
                return self._get_fallback_data(lat, lon)
                
        except Exception as e:
            # 返回模拟数据
            return self._get_fallback_data(lat, lon)
    
    def _get_fallback_data(self, lat: float, lon: float) -> dict:
        """获取备用数据（基于纬度的估算）"""
        # 基于纬度简单估算GHI
        import math
        
        # 纬度越低，GHI越高
        abs_lat = abs(lat)
        base_ghi = 2200  # 赤道附近
        
        # 每增加10度纬度，GHI下降约200
        estimated_ghi = max(800, base_ghi - (abs_lat / 10) * 200)
        
        # 根据经度微调（模拟不同地区差异）
        regional_factor = 1.0 + 0.1 * math.sin(lon * math.pi / 180)
        estimated_ghi *= regional_factor
        
        return {
            "ghi_annual": round(estimated_ghi, 1),
            "dni_annual": round(estimated_ghi * 0.6, 1),
            "dhi_annual": round(estimated_ghi * 0.4, 1),
            "temp_avg": max(0, 30 - abs_lat / 3),
            "data_source": "估算数据（NASA API暂时不可用）",
            "data_period": "长期平均值",
            "note": "这是基于纬度的估算值，仅供参考"
        }


async def assess_solar_resource(lat: float, lon: float) -> dict:
    """评估太阳能资源（便捷函数）"""
    service = NASAPowerService()
    return await service.get_solar_resource(lat, lon)
