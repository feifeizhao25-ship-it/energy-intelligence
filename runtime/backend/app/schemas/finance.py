from pydantic import BaseModel, Field
from typing import Optional, List


class SolarFinanceRequest(BaseModel):
    capacity_mw: float = Field(..., gt=0)
    capex_per_w: float = Field(..., gt=0)  # USD/W
    opex_per_kw_yr: float = Field(..., gt=0)  # USD/kW/yr
    electricity_price: float = Field(..., gt=0)  # USD/MWh
    itc_rate: float = Field(default=0.30, ge=0, le=1)  # 30% ITC
    debt_ratio: float = Field(default=0.70, ge=0, le=1)
    interest_rate: float = Field(default=0.06, ge=0, le=0.20)
    tax_rate: float = Field(default=0.21, ge=0, le=0.50)
    degradation_rate: float = Field(default=0.005, ge=0, le=0.05)
    capacity_factor: float = Field(default=0.22, ge=0.10, le=0.35)
    project_life: int = Field(default=25, ge=10, le=40)
    currency: str = Field(default="USD")


class FinancialModelResponse(BaseModel):
    irr: float  # %
    npv: float  # USD
    lcoe: float  # USD/kWh
    payback_years: float
    equity_irr: float
    dscr_min: float
    cashflows: List[float]  # 25-yr annual net cashflow
    sensitivity: dict  # capex/price sensitivity matrix


class WindFinanceRequest(BaseModel):
    capacity_mw: float = Field(..., gt=0)
    capex_per_kw: float = Field(..., gt=0)  # USD/kW
    opex_per_kw_yr: float = Field(..., gt=0)  # USD/kW/yr
    electricity_price: float = Field(..., gt=0)  # USD/MWh
    wind_capacity_factor: float = Field(default=0.35, ge=0.10, le=0.60)
    debt_ratio: float = Field(default=0.70, ge=0, le=1)
    interest_rate: float = Field(default=0.06, ge=0, le=0.20)
    tax_rate: float = Field(default=0.21, ge=0, le=0.50)
    project_life: int = Field(default=25, ge=10, le=40)
    currency: str = Field(default="USD")


class StorageFinanceRequest(BaseModel):
    power_mw: float = Field(..., gt=0)
    capacity_mwh: float = Field(..., gt=0)
    cycles_per_year: float = Field(..., gt=0, le=365)
    peak_price_per_mwh: float = Field(..., ge=0)
    offpeak_price_per_mwh: float = Field(..., ge=0)
    capex_per_kwh: float = Field(..., gt=0)
    roundtrip_efficiency: float = Field(default=0.88, gt=0, le=1)
    annual_degradation_rate: float = Field(default=0.025, ge=0, le=0.10)
    annual_opex_rate: float = Field(default=0.02, ge=0, le=0.20)
    discount_rate: float = Field(default=0.08, ge=0, le=0.30)
    project_life: int = Field(default=10, ge=5, le=30)
    currency: str = Field(default="USD", pattern="^[A-Z]{3}$")


class StorageFinanceResponse(BaseModel):
    irr: float
    npv: float
    lcos: float
    payback_years: float
    annual_revenue: float
    annual_discharged_mwh: float
    total_capex: float
    cashflows: List[float]
    assumption_version: str
    assumptions: dict
