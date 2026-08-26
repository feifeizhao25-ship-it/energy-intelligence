-- Asset Lifecycle Management System
-- Migration: 20260203_asset_lifecycle
-- 
-- 这是0→1亿的关键功能！让项目从"算一次"变成"长期托管"

-- ========================================
-- 1. 激活的项目表
-- ========================================
CREATE TABLE IF NOT EXISTS activated_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 关联项目
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  
  -- 激活状态
  activation_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  -- INACTIVE, ACTIVATING, ACTIVE, SUSPENDED, ARCHIVED
  
  -- 生命周期阶段
  current_stage VARCHAR(30) NOT NULL DEFAULT 'OPERATING',
  -- PLANNING, DESIGN, FINANCING, CONSTRUCTION, COMMISSIONING, OPERATING, OPTIMIZATION, DECOMMISSIONING
  
  -- 激活时间
  activated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  suspended_at TIMESTAMP,
  
  -- 数据源连接配置
  data_connections JSONB NOT NULL DEFAULT '{}',
  -- {
  --   inverter: { type, endpoint, credentials, pollInterval },
  --   meter: { type, endpoint, protocol },
  --   weather: { provider, location },
  --   grid: { provider, endpoint }
  -- }
  
  -- 自动化配置
  automation_config JSONB NOT NULL DEFAULT '{}',
  -- {
  --   dailyPRCalculation: boolean,
  --   monthlyRevenueReport: boolean,
  --   anomalyDetection: { enabled, thresholds },
  --   performanceAlert: { enabled, recipients, channels },
  --   maintenanceAdvisor: { enabled, frequency }
  -- }
  
  -- 监测统计
  monitoring_stats JSONB NOT NULL DEFAULT '{"totalDaysMonitored": 0, "dataPointsCollected": 0, "anomaliesDetected": 0, "alertsSent": 0, "reportsGenerated": 0}',
  
  -- 时间戳
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- 唯一约束：每个项目只能激活一次
  UNIQUE(project_id)
);

CREATE INDEX idx_activated_projects_user ON activated_projects(user_id);
CREATE INDEX idx_activated_projects_status ON activated_projects(activation_status);
CREATE INDEX idx_activated_projects_stage ON activated_projects(current_stage);

-- ========================================
-- 2. 每日分析记录表
-- ========================================
CREATE TABLE IF NOT EXISTS daily_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 关联项目
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  activated_project_id UUID NOT NULL REFERENCES activated_projects(id) ON DELETE CASCADE,
  
  -- 分析日期
  analysis_date DATE NOT NULL,
  
  -- 发电数据
  generation_actual DECIMAL(12, 2) NOT NULL,      -- 实际发电量 (kWh)
  generation_expected DECIMAL(12, 2) NOT NULL,    -- 预期发电量 (kWh)
  generation_ratio DECIMAL(5, 4) NOT NULL,        -- 实际/预期比例
  
  -- PR数据
  pr DECIMAL(5, 4) NOT NULL,                      -- Performance Ratio
  pr_trend VARCHAR(20) NOT NULL DEFAULT 'STABLE', -- UP, DOWN, STABLE
  
  -- 收益数据
  revenue_actual DECIMAL(12, 2) NOT NULL,         -- 实际收益 (元)
  revenue_expected DECIMAL(12, 2) NOT NULL,       -- 预期收益 (元)
  revenue_deviation DECIMAL(12, 2) NOT NULL,      -- 偏差 (元)
  
  -- 健康度评分
  health_score DECIMAL(5, 2) NOT NULL,            -- 0-100
  trend VARCHAR(20) NOT NULL DEFAULT 'STABLE',    -- IMPROVING, STABLE, DEGRADING
  
  -- 异常检测
  anomalies JSONB NOT NULL DEFAULT '[]',
  -- [{ type, severity, description, recommendation }]
  
  -- 故障统计
  fault_count INTEGER NOT NULL DEFAULT 0,
  
  -- 天气数据（用于分析）
  weather_data JSONB,
  -- { irradiance, temperature, humidity, windSpeed }
  
  -- 时间戳
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- 唯一约束：每个项目每天只有一条记录
  UNIQUE(project_id, analysis_date)
);

CREATE INDEX idx_daily_analysis_project ON daily_analysis(project_id);
CREATE INDEX idx_daily_analysis_date ON daily_analysis(analysis_date DESC);
CREATE INDEX idx_daily_analysis_health ON daily_analysis(health_score);
CREATE INDEX idx_daily_analysis_pr ON daily_analysis(pr);

-- ========================================
-- 3. 资产健康度历史表
-- ========================================
CREATE TABLE IF NOT EXISTS asset_health_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 关联项目
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  activated_project_id UUID NOT NULL REFERENCES activated_projects(id) ON DELETE CASCADE,
  
  -- 整体评分
  overall_score DECIMAL(5, 2) NOT NULL,           -- 0-100
  
  -- 投资等级（对标穆迪/标普）
  investment_grade VARCHAR(10) NOT NULL,          -- AAA, AA, A, BBB, BB, B, C, D
  grade_rationale TEXT NOT NULL,
  
  -- 各维度评分
  dimensions JSONB NOT NULL,
  -- {
  --   performance: { score, pr, prTrend, generationRate, issues },
  --   reliability: { score, faultRate, mtbf, availabilityRate },
  --   financialHealth: { score, actualVsExpectedRevenue, cashFlowStatus, deviationFromIRR },
  --   compliance: { score, regulatoryStatus, certifications, expiringCertificates }
  -- }
  
  -- 改进建议
  improvement_actions JSONB NOT NULL DEFAULT '[]',
  -- [{ action, expectedImpact, estimatedCost, roi }]
  
  -- 评估时间
  assessed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- 时间戳
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_asset_health_project ON asset_health_history(project_id);
CREATE INDEX idx_asset_health_grade ON asset_health_history(investment_grade);
CREATE INDEX idx_asset_health_score ON asset_health_history(overall_score DESC);
CREATE INDEX idx_asset_health_date ON asset_health_history(assessed_at DESC);

-- ========================================
-- 4. 运维计划表
-- ========================================
CREATE TABLE IF NOT EXISTS maintenance_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 关联项目
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  activated_project_id UUID NOT NULL REFERENCES activated_projects(id) ON DELETE CASCADE,
  
  -- 计划周期
  week_of DATE NOT NULL,                          -- 该周的第一天（周一）
  
  -- 任务列表
  tasks JSONB NOT NULL DEFAULT '[]',
  -- [{
  --   priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
  --   action: string,
  --   reason: string,
  --   estimatedCost: number,
  --   estimatedGain: number,
  --   roi: string,
  --   recommendedDate: timestamp,
  --   completed: boolean,
  --   completedAt: timestamp,
  --   completedBy: userId
  -- }]
  
  -- 生成时间
  generated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- 完成状态
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP,
  
  -- 时间戳
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- 唯一约束：每个项目每周只有一个计划
  UNIQUE(project_id, week_of)
);

CREATE INDEX idx_maintenance_plans_project ON maintenance_plans(project_id);
CREATE INDEX idx_maintenance_plans_week ON maintenance_plans(week_of DESC);
CREATE INDEX idx_maintenance_plans_completed ON maintenance_plans(completed);

-- ========================================
-- 5. 实时数据采集表（可选：用于存储原始数据）
-- ========================================
CREATE TABLE IF NOT EXISTS real_time_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 关联项目
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  activated_project_id UUID NOT NULL REFERENCES activated_projects(id) ON DELETE CASCADE,
  
  -- 数据类型
  data_type VARCHAR(50) NOT NULL,
  -- INVERTER, METER, WEATHER, GRID
  
  -- 数据源
  data_source VARCHAR(100) NOT NULL,
  
  -- 原始数据
  raw_data JSONB NOT NULL,
  
  -- 解析后的数据
  parsed_data JSONB,
  
  -- 数据时间戳
  data_timestamp TIMESTAMP NOT NULL,
  
  -- 采集时间
  collected_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- 时间戳
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_real_time_data_project ON real_time_data(project_id);
CREATE INDEX idx_real_time_data_type ON real_time_data(data_type);
CREATE INDEX idx_real_time_data_timestamp ON real_time_data(data_timestamp DESC);

-- 分区表（按月）- 可选优化
-- ALTER TABLE real_time_data PARTITION BY RANGE (data_timestamp);

-- ========================================
-- 6. 告警记录表
-- ========================================
CREATE TABLE IF NOT EXISTS asset_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 关联项目
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  activated_project_id UUID NOT NULL REFERENCES activated_projects(id) ON DELETE CASCADE,
  
  -- 告警类型
  alert_type VARCHAR(50) NOT NULL,
  -- LOW_PR, FREQUENT_FAULTS, GENERATION_DROP, EQUIPMENT_FAILURE, etc.
  
  -- 严重程度
  severity VARCHAR(20) NOT NULL,
  -- LOW, MEDIUM, HIGH, CRITICAL
  
  -- 告警内容
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  recommendation TEXT,
  
  -- 关联数据
  related_data JSONB,
  -- { pr, generationRatio, faultCount, etc. }
  
  -- 状态
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  -- ACTIVE, ACKNOWLEDGED, RESOLVED, IGNORED
  
  -- 发送状态
  sent_to JSONB DEFAULT '[]',
  -- [{ channel: "EMAIL"|"SMS"|"WEBHOOK", recipient: string, sentAt: timestamp, success: boolean }]
  
  -- 处理信息
  acknowledged_at TIMESTAMP,
  acknowledged_by UUID REFERENCES users(id),
  resolved_at TIMESTAMP,
  resolved_by UUID REFERENCES users(id),
  resolution_note TEXT,
  
  -- 时间戳
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_asset_alerts_project ON asset_alerts(project_id);
CREATE INDEX idx_asset_alerts_severity ON asset_alerts(severity);
CREATE INDEX idx_asset_alerts_status ON asset_alerts(status);
CREATE INDEX idx_asset_alerts_created ON asset_alerts(created_at DESC);

-- ========================================
-- 7. 视图：项目激活概览
-- ========================================
CREATE OR REPLACE VIEW v_activated_projects_overview AS
SELECT 
  ap.id,
  ap.project_id,
  p.name AS project_name,
  p.capacity,
  p.location,
  ap.user_id,
  u.name AS user_name,
  ap.activation_status,
  ap.current_stage,
  ap.activated_at,
  
  -- 最新每日分析
  da.analysis_date AS latest_analysis_date,
  da.pr AS latest_pr,
  da.health_score AS latest_health_score,
  da.generation_actual AS latest_generation,
  da.revenue_actual AS latest_revenue,
  
  -- 最新健康度评估
  ah.overall_score AS latest_overall_score,
  ah.investment_grade AS latest_investment_grade,
  ah.assessed_at AS latest_assessment_date,
  
  -- 未完成告警数量
  (SELECT COUNT(*) FROM asset_alerts WHERE project_id = ap.project_id AND status = 'ACTIVE') AS active_alerts_count,
  
  -- 监测统计
  ap.monitoring_stats
  
FROM activated_projects ap
LEFT JOIN projects p ON ap.project_id = p.id
LEFT JOIN users u ON ap.user_id = u.id
LEFT JOIN LATERAL (
  SELECT * FROM daily_analysis 
  WHERE project_id = ap.project_id 
  ORDER BY analysis_date DESC 
  LIMIT 1
) da ON true
LEFT JOIN LATERAL (
  SELECT * FROM asset_health_history 
  WHERE project_id = ap.project_id 
  ORDER BY assessed_at DESC 
  LIMIT 1
) ah ON true;

-- ========================================
-- 8. 触发器：自动更新 updated_at
-- ========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_activated_projects_updated_at
BEFORE UPDATE ON activated_projects
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_maintenance_plans_updated_at
BEFORE UPDATE ON maintenance_plans
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_asset_alerts_updated_at
BEFORE UPDATE ON asset_alerts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- 9. 触发器：自动更新监测统计
-- ========================================
CREATE OR REPLACE FUNCTION update_monitoring_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE activated_projects
  SET monitoring_stats = jsonb_set(
    monitoring_stats,
    '{totalDaysMonitored}',
    to_jsonb((monitoring_stats->>'totalDaysMonitored')::int + 1)
  )
  WHERE id = NEW.activated_project_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_daily_analysis_update_stats
AFTER INSERT ON daily_analysis
FOR EACH ROW
EXECUTE FUNCTION update_monitoring_stats();

-- ========================================
-- 10. 示例数据（可选）
-- ========================================
-- INSERT INTO activated_projects (project_id, user_id, current_stage, data_connections, automation_config)
-- VALUES (
--   'proj-uuid-here',
--   'user-uuid-here',
--   'OPERATING',
--   '{"inverter": {"type": "HUAWEI", "endpoint": "https://api.example.com", "pollInterval": 15}}',
--   '{"dailyPRCalculation": true, "monthlyRevenueReport": true}'
-- );

-- ========================================
-- 完成
-- ========================================
COMMENT ON TABLE activated_projects IS '激活的项目 - 长期托管的核心表';
COMMENT ON TABLE daily_analysis IS '每日分析记录 - 用户每天回来看的数据';
COMMENT ON TABLE asset_health_history IS '资产健康度历史 - 投资等级评定';
COMMENT ON TABLE maintenance_plans IS '运维计划 - 自动化建议';
COMMENT ON TABLE real_time_data IS '实时数据采集 - 原始数据存储';
COMMENT ON TABLE asset_alerts IS '告警记录 - 异常通知';
