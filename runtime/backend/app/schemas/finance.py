from pydantic import BaseModel, Field, PrivateAttr, model_validator
from typing import Any, Dict, Literal, Optional, List

# A wholesale/PPA power price is quoted per MWh and is never below a few currency units
# (10-1500 in USD/EUR/CNY terms). Retail and tariff prices are quoted per kWh (0.03-1.5).
# A bare number below this line is therefore a per-kWh price: 0.32 means 0.32 per kWh = 320 per MWh.
PER_KWH_CEILING = 5.0

PriceUnit = Literal["per_mwh", "per_kwh"]


def price_to_per_mwh(value: float, unit: Optional[str], currency: str, field: str = "electricity_price"):
    """Return (price per MWh, note or None). An explicit unit always wins; no unit is inferred from size."""
    if unit == "per_kwh":
        return value * 1000.0, f"{field} {value:g} {currency}/kWh converted to {value * 1000.0:g} {currency}/MWh."
    if unit == "per_mwh":
        return value, None
    if value < PER_KWH_CEILING:
        return value * 1000.0, (
            f"{field} {value:g} is below {PER_KWH_CEILING:g}, which is not a plausible price per MWh, so it was read as "
            f"{value:g} {currency}/kWh = {value * 1000.0:g} {currency}/MWh. "
            "Send electricity_price_unit ('per_kwh' or 'per_mwh') to make this explicit."
        )
    return value, None


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
    electricity_price_unit: Optional[PriceUnit] = Field(
        default=None, description="per_mwh (default for large numbers) or per_kwh; small bare numbers are read as per kWh",
    )
    data_sources: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Optional sources for the inputs (title, url, retrieved_at); stored with the model so reports can cite them",
    )
    _price_notes: List[str] = PrivateAttr(default_factory=list)

    @model_validator(mode="after")
    def _normalise_price_unit(self):
        price, note = price_to_per_mwh(self.electricity_price, self.electricity_price_unit, self.currency)
        if self.electricity_price_unit != "per_mwh" or note:
            object.__setattr__(self, "electricity_price", price)
        self._price_notes = [note] if note else []
        # The US investment tax credit (30%) is a US-only incentive; a CNY project with no itc_rate sent must not get it.
        if (
            "itc_rate" in type(self).model_fields
            and "itc_rate" not in self.model_fields_set
            and self.currency.upper() == "CNY"
        ):
            self.itc_rate = 0.0
            self._price_notes.append("itc_rate not sent for a CNY project: the US 30% ITC was not applied (itc_rate=0).")
        self.electricity_price_unit = "per_mwh"
        return self

    @property
    def price_notes(self) -> List[str]:
        return list(self._price_notes)


class FinancialModelResponse(BaseModel):
    irr: Optional[float]  # %；现金流无唯一解时为 None
    npv: float  # USD
    lcoe: float  # USD/kWh
    payback_years: float
    equity_irr: Optional[float]
    dscr_min: Optional[float] = None  # 无借款时不编造覆盖倍数
    cashflows: List[float]  # 25-yr annual net cashflow
    sensitivity: dict  # capex/price sensitivity matrix
    input_notes: List[str] = Field(default_factory=list)  # unit conversions applied to the request


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
    electricity_price_unit: Optional[PriceUnit] = Field(
        default=None, description="per_mwh (default for large numbers) or per_kwh; small bare numbers are read as per kWh",
    )
    data_sources: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Optional sources for the inputs (title, url, retrieved_at); stored with the model so reports can cite them",
    )
    _price_notes: List[str] = PrivateAttr(default_factory=list)

    @model_validator(mode="after")
    def _normalise_price_unit(self):
        price, note = price_to_per_mwh(self.electricity_price, self.electricity_price_unit, self.currency)
        if self.electricity_price_unit != "per_mwh" or note:
            object.__setattr__(self, "electricity_price", price)
        self._price_notes = [note] if note else []
        # The US investment tax credit (30%) is a US-only incentive; a CNY project with no itc_rate sent must not get it.
        if (
            "itc_rate" in type(self).model_fields
            and "itc_rate" not in self.model_fields_set
            and self.currency.upper() == "CNY"
        ):
            self.itc_rate = 0.0
            self._price_notes.append("itc_rate not sent for a CNY project: the US 30% ITC was not applied (itc_rate=0).")
        self.electricity_price_unit = "per_mwh"
        return self

    @property
    def price_notes(self) -> List[str]:
        return list(self._price_notes)


class StorageFinanceRequest(BaseModel):
    power_mw: float = Field(..., gt=0)
    capacity_mwh: float = Field(..., gt=0)
    cycles_per_year: float = Field(..., gt=0, le=730)  # up to two full cycles a day
    peak_price_per_mwh: float = Field(..., ge=0)
    offpeak_price_per_mwh: float = Field(..., ge=0)
    capex_per_kwh: float = Field(..., gt=0)
    roundtrip_efficiency: float = Field(default=0.88, gt=0, le=1)
    annual_degradation_rate: float = Field(default=0.025, ge=0, le=0.10)
    annual_opex_rate: float = Field(default=0.02, ge=0, le=0.20)
    discount_rate: float = Field(default=0.08, ge=0, le=0.30)
    project_life: int = Field(default=10, ge=5, le=30)
    currency: str = Field(default="USD", pattern="^[A-Z]{3}$")
    # Only used when saving a model for a report: the sources a person registered for the assumptions.
    data_sources: Optional[List[dict]] = None


class StorageFinanceResponse(BaseModel):
    irr: Optional[float]  # 无唯一解时为 None
    npv: float
    lcos: float
    payback_years: float
    annual_revenue: float
    annual_discharged_mwh: float
    total_capex: float
    cashflows: List[float]
    assumption_version: str
    assumptions: dict
