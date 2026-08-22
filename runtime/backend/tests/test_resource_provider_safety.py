"""External resource providers must fail closed instead of inventing measurements."""

import pytest

from app.schemas.resource import SolarResourceRequest, WindResourceRequest
from app.services import resource_service
from app.services.nasa_power_service import NASAPowerService


class FailingClient:
    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        raise TimeoutError("provider timeout")

    async def __aexit__(self, exc_type, exc, tb):
        return False


@pytest.mark.asyncio
async def test_open_meteo_solar_failure_has_no_synthetic_result(monkeypatch):
    monkeypatch.setattr(resource_service.httpx, "AsyncClient", FailingClient)
    with pytest.raises(RuntimeError, match="solar resource data is currently unavailable"):
        await resource_service.fetch_solar_resource(SolarResourceRequest(lat=31.2, lng=121.5))


@pytest.mark.asyncio
async def test_open_meteo_wind_failure_has_no_synthetic_result(monkeypatch):
    monkeypatch.setattr(resource_service.httpx, "AsyncClient", FailingClient)
    with pytest.raises(RuntimeError, match="wind resource data is currently unavailable"):
        await resource_service.fetch_wind_resource(WindResourceRequest(lat=31.2, lng=121.5))


@pytest.mark.asyncio
async def test_nasa_failure_has_no_latitude_estimate(monkeypatch):
    from app.services import nasa_power_service

    monkeypatch.setattr(nasa_power_service.httpx, "AsyncClient", FailingClient)
    with pytest.raises(RuntimeError, match="NASA POWER solar resource data is currently unavailable"):
        await NASAPowerService().get_solar_resource(31.2, 121.5)
