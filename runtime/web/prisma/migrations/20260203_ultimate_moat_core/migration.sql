-- ==================== 终极护城河架构 - 数据库Schema ====================
-- 添加核心内核所需的表结构

-- 1. 口径版本表
CREATE TABLE IF NOT EXISTS assumption_versions (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    effective_date TIMESTAMP NOT NULL,
    standards JSONB NOT NULL,
    changelog TEXT,
    deprecated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 插入当前标准版本
INSERT INTO assumption_versions (id, name, effective_date, standards, changelog, deprecated) VALUES (
    'v2024.1',
    '2024年标准口径',
    '2024-01-01',
    '{
        "prCalculation": {
            "formula": "PR = (实际发电量 / 理论发电量) × 100%",
            "excludeConditions": ["辐照度 < 100 W/m²", "系统故障期间", "电网限电期间", "极端天气"],
            "referenceStandard": "IEC 61724-1:2017"
        },
        "lcoeCalculation": {
            "discountRate": 0.08,
            "systemLifetime": 25,
            "degradationRate": 0.005,
            "referenceStandard": "NREL ATB 2023"
        },
        "irrCalculation": {
            "taxRate": 0.25,
            "constructionPeriod": 1,
            "operationPeriod": 25,
            "referenceStandard": "国家发改委投资项目评估方法"
        },
        "storageArbitrage": {
            "roundTripEfficiency": 0.90,
            "cycleLifetime": 6000,
            "peakValleyDelta": 0.5,
            "degradationRate": 0.02
        },
        "diagnostics": {
            "prThreshold": {
                "excellent": 0.85,
                "good": 0.75,
                "fair": 0.65,
                "poor": 0.65
            },
            "dustLossThreshold": 0.05,
            "shadingLossThreshold": 0.03
        }
    }',
    '初始标准版本，基于IEC 61724-1:2017、NREL ATB 2023等行业标准制定',
    FALSE
) ON CONFLICT (id) DO NOTHING;

-- 2. 证据链表
CREATE TABLE IF NOT EXISTS evidence_chains (
    id VARCHAR(100) PRIMARY KEY,
    conclusion_id VARCHAR(100) NOT NULL,
    data_provenance JSONB NOT NULL,
    calculation_meta JSONB NOT NULL,
    uncertainty_analysis JSONB,
    reference_papers JSONB,
    regulatory_compliance TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- 索引
    INDEX idx_evidence_conclusion (conclusion_id),
    INDEX idx_evidence_created (created_at DESC)
);

-- 3. 计算结果表（用于持久化和审计）
CREATE TABLE IF NOT EXISTS calculation_results (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100),
    project_id VARCHAR(100),
    result_type VARCHAR(50) NOT NULL, -- 'SOLAR', 'WIND', 'STORAGE', 'DIAGNOSTIC'
    result_data JSONB NOT NULL,
    audit_meta JSONB NOT NULL,
    evidence_chain_id VARCHAR(100) REFERENCES evidence_chains(id),
    reproduce_command JSONB NOT NULL,
    deliverables JSONB,
    quality_tag VARCHAR(20) NOT NULL, -- 'PREVIEW', 'STANDARD', 'AUDIT_GRADE'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- 关联关系
    CONSTRAINT fk_calc_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_calc_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
    
    -- 索引
    INDEX idx_calc_user (user_id, created_at DESC),
    INDEX idx_calc_project (project_id, created_at DESC),
    INDEX idx_calc_type (result_type, created_at DESC),
    INDEX idx_calc_quality (quality_tag),
    INDEX idx_calc_hash ((audit_meta->>'hash'))
);

-- 4. 审计日志表（增强版）
CREATE TABLE IF NOT EXISTS audit_logs_v2 (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100),
    action_type VARCHAR(50) NOT NULL, -- 'CALCULATION', 'DIAGNOSIS', 'MAINTENANCE', 'REPORT_GENERATED'
    resource_type VARCHAR(50),
    resource_id VARCHAR(100),
    assumption_version VARCHAR(50),
    quality_tag VARCHAR(20),
    evidence_chain_id VARCHAR(100),
    ip_address VARCHAR(50),
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- 索引
    INDEX idx_audit_user (user_id, created_at DESC),
    INDEX idx_audit_action (action_type, created_at DESC),
    INDEX idx_audit_resource (resource_type, resource_id),
    INDEX idx_audit_version (assumption_version)
);

-- 5. 项目时间线表
CREATE TABLE IF NOT EXISTS project_timeline (
    id VARCHAR(100) PRIMARY KEY,
    project_id VARCHAR(100) NOT NULL,
    milestone_type VARCHAR(50) NOT NULL, -- 'CALCULATION', 'DIAGNOSIS', 'REPORT', 'DECISION', 'AI_CONCLUSION'
    title VARCHAR(200) NOT NULL,
    summary TEXT,
    artifact_id VARCHAR(100),
    evidence_chain_id VARCHAR(100),
    deliverables JSONB,
    executor_type VARCHAR(20) NOT NULL, -- 'USER', 'AI', 'SYSTEM'
    executor_id VARCHAR(100),
    ai_model VARCHAR(50),
    assumption_version VARCHAR(50),
    impact JSONB, -- financial_saving, generation_increase, downtime_reduced
    tags TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- 关联关系
    CONSTRAINT fk_timeline_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    
    -- 索引
    INDEX idx_timeline_project (project_id, created_at DESC),
    INDEX idx_timeline_type (milestone_type, created_at DESC),
    INDEX idx_timeline_tags USING GIN(tags)
);

-- 6. 标准报告表
CREATE TABLE IF NOT EXISTS standard_reports (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100),
    project_id VARCHAR(100),
    report_type VARCHAR(50) NOT NULL, -- '资源评估', '投资分析', '运维月报', '诊断复盘'
    cover JSONB NOT NULL,
    executive_summary JSONB NOT NULL,
    detailed_analysis JSONB NOT NULL,
    evidence_appendix JSONB NOT NULL,
    compliance JSONB NOT NULL,
    metadata JSONB NOT NULL, -- reportId, version, hash, reproducible
    pdf_url VARCHAR(500),
    excel_url VARCHAR(500),
    json_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- 关联关系
    CONSTRAINT fk_report_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_report_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
    
    -- 索引
    INDEX idx_report_user (user_id, created_at DESC),
    INDEX idx_report_project (project_id, created_at DESC),
    INDEX idx_report_type (report_type, created_at DESC),
    INDEX idx_report_hash ((metadata->>'hash'))
);

-- 7. 添加Project表的时间线导出标记
ALTER TABLE projects ADD COLUMN IF NOT EXISTS timeline_exportable BOOLEAN DEFAULT TRUE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_timeline_export TIMESTAMP;

-- 8. 创建视图：快速查询审计级计算
CREATE OR REPLACE VIEW audit_grade_calculations AS
SELECT 
    cr.id,
    cr.user_id,
    cr.project_id,
    cr.result_type,
    cr.quality_tag,
    cr.audit_meta->>'assumptionVersion' as assumption_version,
    cr.audit_meta->>'hash' as result_hash,
    ec.regulatory_compliance,
    cr.created_at
FROM calculation_results cr
LEFT JOIN evidence_chains ec ON cr.evidence_chain_id = ec.id
WHERE cr.quality_tag = 'AUDIT_GRADE';

-- 9. 创建视图：项目完整时间线
CREATE OR REPLACE VIEW project_timeline_summary AS
SELECT 
    pt.project_id,
    p.name as project_name,
    COUNT(*) as total_milestones,
    COUNT(CASE WHEN pt.milestone_type = 'CALCULATION' THEN 1 END) as calculations_count,
    COUNT(CASE WHEN pt.milestone_type = 'DIAGNOSIS' THEN 1 END) as diagnoses_count,
    COUNT(CASE WHEN pt.milestone_type = 'REPORT' THEN 1 END) as reports_count,
    SUM((pt.impact->>'financialSaving')::numeric) as total_savings,
    MIN(pt.created_at) as first_activity,
    MAX(pt.created_at) as last_activity
FROM project_timeline pt
JOIN projects p ON pt.project_id = p.id
GROUP BY pt.project_id, p.name;

-- 10. 触发器：自动记录审计日志
CREATE OR REPLACE FUNCTION log_calculation_audit()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_logs_v2 (
        id,
        user_id,
        action_type,
        resource_type,
        resource_id,
        assumption_version,
        quality_tag,
        evidence_chain_id,
        metadata,
        created_at
    ) VALUES (
        'audit-' || NEW.id,
        NEW.user_id,
        'CALCULATION',
        NEW.result_type,
        NEW.id,
        NEW.audit_meta->>'assumptionVersion',
        NEW.quality_tag,
        NEW.evidence_chain_id,
        jsonb_build_object(
            'reproduce_command', NEW.reproduce_command,
            'has_deliverables', NEW.deliverables IS NOT NULL
        ),
        NEW.created_at
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calculation_audit
AFTER INSERT ON calculation_results
FOR EACH ROW
EXECUTE FUNCTION log_calculation_audit();

-- 11. 触发器：自动更新项目时间线
CREATE OR REPLACE FUNCTION update_project_timeline()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO project_timeline (
        id,
        project_id,
        milestone_type,
        title,
        summary,
        artifact_id,
        evidence_chain_id,
        executor_type,
        executor_id,
        assumption_version,
        created_at
    ) VALUES (
        'timeline-' || NEW.id,
        NEW.project_id,
        'CALCULATION',
        NEW.result_type || '计算完成',
        '质量等级: ' || NEW.quality_tag,
        NEW.id,
        NEW.evidence_chain_id,
        'USER',
        NEW.user_id,
        NEW.audit_meta->>'assumptionVersion',
        NEW.created_at
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_project_timeline_update
AFTER INSERT ON calculation_results
FOR EACH ROW
WHEN (NEW.project_id IS NOT NULL)
EXECUTE FUNCTION update_project_timeline();

-- 12. 数据库函数：验证结果哈希
CREATE OR REPLACE FUNCTION verify_result_hash(result_id VARCHAR)
RETURNS TABLE(valid BOOLEAN, message TEXT) AS $$
DECLARE
    stored_hash TEXT;
    calculated_hash TEXT;
BEGIN
    SELECT audit_meta->>'hash' INTO stored_hash
    FROM calculation_results
    WHERE id = result_id;
    
    IF stored_hash IS NULL THEN
        RETURN QUERY SELECT FALSE, '结果不存在或缺少哈希';
        RETURN;
    END IF;
    
    -- 注意：实际哈希验证需要在应用层完成
    -- 这里只是示例结构
    RETURN QUERY SELECT TRUE, '哈希存在，请在应用层验证';
END;
$$ LANGUAGE plpgsql;

-- 13. 性能优化：分区表（按月分区计算结果，适用于大规模使用）
-- CREATE TABLE calculation_results_2024_01 PARTITION OF calculation_results
-- FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
-- ... (可根据需要添加)

-- 14. 创建索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_calc_created_brin ON calculation_results USING BRIN (created_at);
CREATE INDEX IF NOT EXISTS idx_timeline_created_brin ON project_timeline USING BRIN (created_at);

-- 15. 清理和维护脚本（注释掉，仅在需要时手动执行）
-- 删除超过1年的PREVIEW级计算结果
-- DELETE FROM calculation_results 
-- WHERE quality_tag = 'PREVIEW' 
--   AND created_at < NOW() - INTERVAL '1 year';

-- 压缩旧数据
-- VACUUM ANALYZE calculation_results;
-- VACUUM ANALYZE evidence_chains;

COMMENT ON TABLE assumption_versions IS '口径版本管理表 - 存储计算标准的各个版本';
COMMENT ON TABLE evidence_chains IS '证据链表 - 记录每个计算的完整数据来源和证据';
COMMENT ON TABLE calculation_results IS '计算结果表 - 持久化所有计算结果用于审计和复现';
COMMENT ON TABLE project_timeline IS '项目时间线表 - 记录项目的所有关键里程碑';
COMMENT ON TABLE standard_reports IS '标准报告表 - 存储生成的标准化交付物';
COMMENT ON TABLE audit_logs_v2 IS '审计日志表v2 - 增强版审计追踪';

-- 完成
SELECT 'Ultimate Moat Database Schema created successfully! 🏰' as status;
