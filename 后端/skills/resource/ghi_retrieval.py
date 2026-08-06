class GHIRetrievalInput:
    year_range: str = "2005-2024"  # 数据年份范围
    market: str = "cn"
class GHIOutput:
    data_quality: str
    methodology: str = "synthetic_reference_model"
    warning: str = ""
    unit: str = "kWh/m²"
        assessment = self._generate_assessment(solar_class, ghi_annual, input_data.market)
            data_source="synthetic_reference_model",
            data_quality="estimated",
            warning=(
                "Estimated demonstration result. Connect NASA POWER, Solargis, "
                "or another verified weather source before making decisions."
                if input_data.market in {"global", "int", "en"}
                else "估算演示结果，正式决策前必须接入 NASA POWER、Solargis 或其他已验证气象数据源。"
            ),
    def _generate_assessment(self, solar_class: str, ghi: float, market: str = "cn") -> str:
        assessments_zh = {
        }
        assessments_en = {
            "A": f"Estimated annual GHI is {ghi:.0f} kWh/m², indicating an excellent solar resource. Verify against a bankable weather dataset before investment.",
            "B": f"Estimated annual GHI is {ghi:.0f} kWh/m², indicating a good solar resource. Validate design assumptions with measured or bankable data.",
            "C": f"Estimated annual GHI is {ghi:.0f} kWh/m², indicating a moderate solar resource. Detailed economic analysis is required.",
            "D": f"Estimated annual GHI is {ghi:.0f} kWh/m², indicating a limited solar resource. Distributed or specialized applications may be more appropriate.",
            "F": f"Estimated annual GHI is {ghi:.0f} kWh/m², indicating a poor solar resource for utility-scale development.",
        }
        if market in {"global", "int", "en"}:
            return assessments_en.get(solar_class, "Solar resource estimate completed.")
        return assessments_zh.get(solar_class, "资源评估完成。")
def get_solar_resource(lat: float, lon: float, source: str = "nasapower", market: str = "cn") -> dict:
        data_source=source,
        market=market,
        "unit": "kWh/m²",
        "data_source": result.data_source,
        "data_quality": result.data_quality,
        "methodology": result.methodology,
        "warning": result.warning,
    }
