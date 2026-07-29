from pydantic import BaseModel, Field
from typing import Optional, List


class SolarResourceRequest(BaseModel):
    lat: float = Field(..., ge=-90, le=90, description="Latitude (WGS84)")
    lng: float = Field(..., ge=-180, le=180, description="Longitude (WGS84)")
    data_source: str = Field(default="nasa_power", description="nasa_power|era5|nsrdb")
    start_year: int = Field(default=2010, ge=1981, le=2023)
    end_year: int = Field(default=2020, ge=1981, le=2023)
    project_id: Optional[str] = Field(None, description="Associate with a project")


class SolarResourceResponse(BaseModel):
    lat: float
    lng: float
    ghi: float  # kWh/m²/yr
    dni: float
    dhi: float
    peak_sun_hours: float
    optimal_tilt: float
    avg_temperature: float
    resource_class: str  # I/II/III/IV
    score: float  # 0-100
    data_source: str
    monthly_ghi: List[float]


class WindResourceRequest(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    hub_height: int = Field(default=100, description="Hub height in meters")
    data_source: str = Field(default="era5")
    project_id: Optional[str] = Field(None, description="Associate with a project")


class WindResourceResponse(BaseModel):
    lat: float
    lng: float
    mean_speed: float  # m/s at hub height
    weibull_k: float
    weibull_c: float
    wind_power_density: float  # W/m²
    turbulence_intensity: float
    resource_class: str
    score: float
    monthly_speed: List[float]
