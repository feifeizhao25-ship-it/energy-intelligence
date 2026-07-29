"""新增缺失的 9 张表 — 运维/资产管理相关"""
import sqlite3, os

DB_PATH = "/Users/feifei00/Documents/新能源智库/backend/energy_dev.db"

STATEMENTS = [
    # 用户角色多对多
    """CREATE TABLE IF NOT EXISTS user_roles (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        role_id TEXT NOT NULL REFERENCES roles(id),
        org_id TEXT REFERENCES organizations(id),
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        assigned_by TEXT,
        UNIQUE(user_id, role_id, org_id)
    )""",

    # 现金流明细（财务场景子表）
    """CREATE TABLE IF NOT EXISTS cashflows (
        id TEXT PRIMARY KEY,
        scenario_id TEXT NOT NULL REFERENCES financial_scenarios(id),
        year INTEGER NOT NULL,
        amount REAL NOT NULL,
        category TEXT DEFAULT 'operating',
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )""",

    # 电站原始数据（汇总表，区别于 hourly/daily）
    """CREATE TABLE IF NOT EXISTS plant_data (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id),
        date DATE NOT NULL,
        generation_kwh REAL DEFAULT 0,
        irradiance_kwh_m2 REAL DEFAULT 0,
        availability REAL DEFAULT 100.0,
        performance_ratio REAL DEFAULT 0,
        grid_power_kw REAL DEFAULT 0,
        data_source TEXT DEFAULT 'manual',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(project_id, date)
    )""",

    # 设备规格
    """CREATE TABLE IF NOT EXISTS equipment_specs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id),
        equipment_type TEXT NOT NULL,
        manufacturer TEXT,
        model TEXT,
        capacity_kw REAL,
        commissioning_date DATE,
        warranty_expiry DATE,
        serial_number TEXT,
        specs_json TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )""",

    # 质保索赔
    """CREATE TABLE IF NOT EXISTS warranty_claims (
        id TEXT PRIMARY KEY,
        equipment_id TEXT NOT NULL REFERENCES equipment_specs(id),
        claim_date DATE NOT NULL,
        issue_description TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        resolution TEXT,
        cost REAL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )""",

    # 备品备件库存
    """CREATE TABLE IF NOT EXISTS spare_parts_inventory (
        id TEXT PRIMARY KEY,
        org_id TEXT REFERENCES organizations(id),
        part_name TEXT NOT NULL,
        part_number TEXT,
        quantity INTEGER DEFAULT 0,
        min_quantity INTEGER DEFAULT 0,
        unit_cost REAL DEFAULT 0,
        location TEXT,
        last_restocked TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )""",

    # 并网接口
    """CREATE TABLE IF NOT EXISTS grid_interconnection (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id),
        poi_name TEXT NOT NULL,
        voltage_kv REAL,
        capacity_mw REAL,
        grid_operator TEXT,
        connection_type TEXT,
        agreement_date DATE,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )""",

    # 环保许可
    """CREATE TABLE IF NOT EXISTS environmental_permits (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id),
        permit_type TEXT NOT NULL,
        permit_number TEXT,
        issuing_authority TEXT,
        issue_date DATE,
        expiry_date DATE,
        conditions TEXT,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )""",

    # 保险
    """CREATE TABLE IF NOT EXISTS insurance_policies (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id),
        policy_type TEXT NOT NULL,
        insurer TEXT,
        policy_number TEXT,
        coverage_amount REAL,
        premium_annual REAL,
        start_date DATE,
        end_date DATE,
        beneficiary TEXT,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )""",
]

def main():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    for stmt in STATEMENTS:
        cursor.execute(stmt)
    conn.commit()

    # Verify
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    tables = [r[0] for r in cursor.fetchall()]
    print(f"Total tables: {len(tables)}")

    new_tables = ["user_roles","cashflows","plant_data","equipment_specs","warranty_claims","spare_parts_inventory","grid_interconnection","environmental_permits","insurance_policies"]
    for t in new_tables:
        assert t in tables, f"Missing: {t}"
        print(f"  ✅ {t}")
    conn.close()
    print(f"\nAll {len(new_tables)} new tables created successfully.")

if __name__ == "__main__":
    main()
