"""V26 P71: 真实后端测试 (打 8000, 等 5s 避开 429)"""
import pytest
import time
import json
import requests
import urllib.request
import subprocess

API = "http://127.0.0.1:8000/api/v1"
_last_call = 0

def _live_server_reachable() -> bool:
    """集成测试需要本地运行中的后端；未启动时整模块跳过。"""
    import socket
    from urllib.parse import urlparse
    parsed = urlparse(API)
    try:
        with socket.create_connection((parsed.hostname, urlparse(API).port), timeout=1):
            return True
    except OSError:
        return False


pytestmark = pytest.mark.skipif(
    not _live_server_reachable(),
    reason=f"live backend not running at {API}",
)


def _throttled_get(path, token, **kwargs):
    """避免 429 限流: 每次调用间隔 3s"""
    global _last_call
    now = time.time()
    if now - _last_call < 3:
        time.sleep(3 - (now - _last_call))
    _last_call = time.time()
    return requests.get(f"{API}{path}",
        headers={"Authorization": f"Bearer {token}"}, timeout=15, **kwargs)


def _throttled_post(path, body, token):
    global _last_call
    now = time.time()
    if now - _last_call < 3:
        time.sleep(3 - (now - _last_call))
    _last_call = time.time()
    return requests.post(f"{API}{path}",
        json=body, headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        timeout=20)


@pytest.fixture(scope="module")
def admin_token():
    email = f"v26_{int(time.time())}@test.com"
    # 先确保 DB 是 admin (重置)
    subprocess.run(['sqlite3', '/Users/feifei00/Documents/新能源智库/backend/energy_dev.db',
        f"UPDATE users SET is_superadmin=1, role='admin', subscription_plan='enterprise' WHERE email='{email}'"],
        capture_output=True, timeout=5)
    # 登录
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": "Test1234!"}, timeout=10)
    if r.status_code == 200:
        return r.json()["data"]["access_token"]
    # 不存在就注册
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": "Test1234!", "name": "V26"}, timeout=10)
    time.sleep(0.5)
    # 再 update admin
    subprocess.run(['sqlite3', '/Users/feifei00/Documents/新能源智库/backend/energy_dev.db',
        f"UPDATE users SET is_superadmin=1, role='admin', subscription_plan='enterprise' WHERE email='{email}'"],
        capture_output=True, timeout=5)
    time.sleep(0.5)
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": "Test1234!"}, timeout=10)
    return r.json()["data"]["access_token"]


class TestV26AuditFix:
    """P59: audit/logs 500 错误修复"""

    def test_audit_logs_success(self, admin_token):
        r = _throttled_get("/audit/logs?page=1&page_size=5", admin_token)
        assert r.status_code == 200, f"HTTP {r.status_code}: {r.text[:200]}"
        data = r.json()
        assert data.get("success") is True, f"audit/logs failed: {data}"
        assert "data" in data
        assert isinstance(data["data"], list)

    def test_audit_logs_my_success(self, admin_token):
        r = _throttled_get("/audit/logs/my?page=1&page_size=5", admin_token)
        assert r.status_code == 200
        data = r.json()
        assert data.get("success") is True
        assert "data" in data

    def test_audit_log_id_is_string(self, admin_token):
        r = _throttled_get("/audit/logs?page=1&page_size=2", admin_token)
        data = r.json()
        if data.get("data"):
            for log in data["data"]:
                assert isinstance(log["id"], str), f"id should be str, got {type(log['id'])}"


class TestV26ResearchFix:
    """P68: research/papers wrapper 修复"""

    def test_research_papers_wrapper(self, admin_token):
        r = _throttled_get("/research/papers?q=solar", admin_token)
        assert r.status_code == 200
        data = r.json()
        assert data.get("success") is True, f"papers failed: {data}"
        assert "data" in data
        assert "items" in data["data"]


class TestV26Finance:
    """P66: 4 财务端点真实计算"""

    def test_lcoe_25years(self, admin_token):
        r = _throttled_post("/finance/lcoe", {
            "capex": 400000000, "annual_opex": 5000000,
            "annual_gen_kwh": 250000000, "discount_rate": 0.06, "lifetime": 25
        }, admin_token)
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is True
        assert 0.1 < data["data"]["lcoe"] < 0.5

    def test_solar_100mw(self, admin_token):
        r = _throttled_post("/finance/solar", {
            "capacity_mw": 100, "lat": 36, "lng": 100,
            "capex_per_w": 4.0, "opex_per_kw_yr": 80, "electricity_price": 0.42,
            "ghi_annual": 1600, "capacity_factor": 0.18, "lifetime": 25
        }, admin_token)
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is True
        d = data["data"]
        assert d["irr"] > 5
        assert d["npv"] > 0
        assert 0.1 < d["lcoe"] < 0.5

    def test_wind_200mw(self, admin_token):
        r = _throttled_post("/finance/wind", {
            "capacity_mw": 200, "lat": 36, "lng": 100,
            "capex_per_kw": 6500, "opex_per_kw_yr": 150, "electricity_price": 0.42,
            "wind_speed": 7.0, "wind_capacity_factor": 0.30, "lifetime": 20
        }, admin_token)
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is True
        d = data["data"]
        assert d["irr"] > 5
        assert d["npv"] > 0


class TestV26Admin:
    """P55: 4 admin 端点"""

    def test_admin_skills(self, admin_token):
        r = _throttled_get("/admin/skills", admin_token)
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is True
        assert len(data["data"]) > 100

    def test_admin_health(self, admin_token):
        r = _throttled_get("/admin/system/health", admin_token)
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is True
        assert data["data"]["api"] == "healthy"
        assert data["data"]["database"] == "healthy"

    def test_admin_users(self, admin_token):
        r = _throttled_get("/admin/users?page=1&page_size=5", admin_token)
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is True
        assert len(data["data"]) > 0
