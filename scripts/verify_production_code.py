#!/usr/bin/env python3
"""Fail CI when production-facing code can present synthetic results as real."""

from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
errors: list[str] = []


def require(path: str, text: str) -> None:
    target = ROOT / path
    if not target.is_file():
        errors.append(f"{path}: required production source file is missing")
        return
    content = target.read_text(encoding="utf-8")
    if text not in content:
        errors.append(f"{path}: missing production guard {text!r}")


def forbid_tree(path: str, patterns: tuple[str, ...]) -> None:
    for file in (ROOT / path).rglob("*"):
        if file.suffix not in {".ts", ".tsx", ".js", ".jsx"} or not file.is_file():
            continue
        content = file.read_text(encoding="utf-8")
        for pattern in patterns:
            if pattern in content:
                errors.append(f"{file.relative_to(ROOT)}: forbidden production UI text {pattern!r}")


require(
    "services/knowledge-service/app/skills/knowledge_management.py",
    "synthetic fallback is disabled in production",
)
require(
    "services/ai-engine/app/vector_store/milvus_client.py",
    "refusing to generate synthetic production embeddings",
)
require(
    "services/ai-engine/app/skills/v31_new_skills.py",
    "No synthetic result was generated.",
)
require(
    "runtime/backend/app/services/resource_service.py",
    "production calculations never use synthetic data",
)
require(
    "runtime/backend/app/services/nasa_power_service.py",
    "NASA POWER solar resource data is currently unavailable",
)
require(
    "runtime/backend/app/routers/reports.py",
    "仅使用当前用户拥有的真实项目数据",
)
require(
    "runtime/backend/app/routers/reports.py",
    "财务模型缺少可核验的数据来源",
)
require(
    "runtime/backend/Dockerfile",
    "fonts-noto-cjk",
)
require(
    "runtime/web/src/lib/api/semantic-scholar.ts",
    "未返回任何替代或模拟论文",
)
require(
    "runtime/web/src/app/api/v1/papers/search/route.ts",
    "UPSTREAM_UNAVAILABLE",
)
require(
    "runtime/web/src/lib/api/arxiv.ts",
    "https://export.arxiv.org/api/query",
)
require(
    "runtime/web/src/lib/api/openalex.ts",
    "未返回模拟论文",
)
require(
    "runtime/web/src/app/api/papers/chat/route.ts",
    "NO_VERIFIED_EVIDENCE",
)
require(
    "runtime/web/src/lib/papers/search.ts",
    "全部学术数据源暂时不可用，未返回空结果或模拟论文",
)
require(
    "runtime/web/src/lib/crawler/policy-crawler.ts",
    "绝不回退到静态补贴金额或伪造的 /mock 链接",
)
require(
    "runtime/web/src/app/api/papers/search/route.ts",
    "UPSTREAM_UNAVAILABLE",
)
require(
    "runtime/web/src/lib/supabase.ts",
    "服务端数据操作已拒绝",
)
require(
    "runtime/docker-compose.production.yml",
    "OPENALEX_CONTACT_EMAIL is required",
)
require(
    "runtime/web/src/lib/ai/router.ts",
    "AI 服务已拒绝生成替代内容",
)
require(
    "runtime/web/src/lib/ai/router.ts",
    "向量服务已拒绝生成替代向量",
)
require(
    "runtime/web/src/app/api/orchestrator/route.ts",
    "当前账号还没有项目，请先创建项目",
)
require(
    "runtime/web/src/app/(dashboard)/projects/page.tsx",
    "今日发电', value: '待接入",
)
require(
    "runtime/web/src/app/(dashboard)/projects/[id]/page.tsx",
    "尚无已采集的发电数据",
)
require(
    "runtime/web/src/app/(dashboard)/projects/[id]/page.tsx",
    "暂无真实告警记录",
)
require(
    "runtime/web/src/contexts/StationContext.tsx",
    "const INITIAL_STATIONS: Station[] = [];",
)
require(
    "runtime/web/src/contexts/StationContext.tsx",
    "const INITIAL_ISSUES: Issue[] = [];",
)
require(
    "runtime/web/src/app/(dashboard)/referral/page.tsx",
    "系统不会生成示例邀请码、虚构好友记录或未配置的返现承诺",
)
require("runtime/web/src/middleware.ts", "'/terms'")
require("runtime/web/src/middleware.ts", "'/privacy'")
require(
    "runtime/web/src/app/api/projects/diagnosis/route.ts",
    "NO_VERIFIED_TELEMETRY",
)
for telemetry_route in (
    "runtime/web/src/app/api/projects/[id]/monitoring/route.ts",
    "runtime/web/src/app/api/projects/[id]/analytics/route.ts",
    "runtime/web/src/app/api/projects/[id]/reports/route.ts",
    "runtime/web/src/app/api/v1/projects/[id]/monitoring/route.ts",
):
    require(telemetry_route, "503")
require(
    "runtime/web/src/lib/api/nasa-power.ts",
    "历史气象数据暂时不可用，请稍后重试",
)
require(
    "runtime/web/src/lib/api/nasa-power.ts",
    "direction: null",
)
forbid_tree(
    "web-global/src",
    (
        "realbackend",
        "backendreal",
        'https://docs.example.com/',
        'https://example.com/wp',
        "mock-user-id",
    ),
)
forbid_tree(
    "runtime/web/src",
    (
        "超级测试账号硬编码逻辑",
        "dev-master-id",
        "cus_demo",
        "模拟支付成功",
        "MOCK_PAY_",
        "400-888-8888",
        "business@xinnengyuan.com",
        "sourceUrl: 'https://fgw.sh.gov.cn/mock'",
        "sourceUrl: 'https://fgw.beijing.gov.cn/mock'",
        "sourceUrl: 'https://fgw.jiangsu.gov.cn/mock'",
        "sourceUrl: 'https://fzggw.zj.gov.cn/mock'",
        "sourceUrl: 'https://fzggw.gd.gov.cn/mock'",
        "const mockQuestions = [",
        "let questions: Question[] = [",
        "const mockPapers = [",
        "Math.floor(Math.random() * 5)",
        "mock-el-original.jpg",
        "Mock JSON response",
        "const projectsData = [",
        "const demoNotifications = [",
        "export-mock-1",
    ),
)
require(
    "runtime/web/src/lib/maintenance/solar-advanced.ts",
    "未生成任何诊断结果",
)
require(
    "runtime/web/src/lib/maintenance/wind-advanced.ts",
    "叶片图像分析服务尚未接入经验证的生产模型",
)
require(
    "runtime/web/src/app/api/community/questions/route.ts",
    "COMMUNITY_STORAGE_UNAVAILABLE",
)
require("runtime/web/src/app/api/v1/projects/route.ts", "未返回示例数据")
require("runtime/web/src/app/api/v1/projects/[id]/route.ts", "userId: keyData.userId")
require("runtime/web/src/app/api/exports/route.ts", "未生成随机数据")
require("runtime/web/src/lib/ai/router.ts", "deepseek/deepseek-v3.2")
require("runtime/web/src/lib/ai/router.ts", "data_collection: 'deny'")
require("runtime/web/src/lib/ai/router.ts", "Math.min(4096")
require("runtime/backend/app/services/ai_service.py", '"zdr": True')
require("runtime/backend/app/services/ai_service.py", "chat_openai_with_metadata")
require("runtime/backend/app/api/v1/ai_assistant.py", '"ai_metadata"')
for mobile_root in ("android-global/lib", "ios-global/lib"):
    forbid_tree(
        mobile_root,
        (
            "http://116.62.32.43",
            "MockData.projects",
            "MockData.weeklyGen",
            "847 GWh",
            "\$46.6M",
            "Fallback: compute locally",
            "Navigator.pushReplacementNamed(context, '/main');\n  }",
        ),
    )
    require(
        f"{mobile_root}/services/api_service.dart",
        "API_BASE_URL must be supplied as an HTTPS URL",
    )
    require(
        f"{mobile_root}/screens/auth/login_screen.dart",
        "await ApiService.login",
    )
    require(
        f"{mobile_root}/screens/auth/register_screen.dart",
        "await ApiService.register",
    )
    require(
        f"{mobile_root}/screens/resource/solar_resource_screen.dart",
        "Verified solar resource data is temporarily unavailable",
    )
    require(
        f"{mobile_root}/screens/finance/wind_finance_screen.dart",
        "await ApiService.calcWindFinance",
    )
    require(
        f"{mobile_root}/screens/finance/storage_finance_screen.dart",
        "await ApiService.calcStorageFinance",
    )
    require(
        f"{mobile_root}/screens/operations/cleaning_screen.dart",
        "await ApiService.calculateCleaningSchedule",
    )
    require(
        f"{mobile_root}/screens/operations/anomaly_screen.dart",
        "No synthetic alerts are shown",
    )
for mobile_root in ("android-cn/lib", "ios-cn/lib"):
    require(
        f"{mobile_root}/screens/operations/anomaly_screen.dart",
        "不会生成示例设备、随机指标或虚构损失",
    )
    forbid_tree(
        mobile_root,
        (
            "Deterministic mock anomalies",
            "山东德州100MW光伏",
            "estimatedLoss': 18600.0",
        ),
    )
require(
    "runtime/backend/app/api/v1/finance.py",
    "storage-arbitrage-v1.0",
)
require(
    "runtime/backend/app/api/v1/operations.py",
    "cleaning-economic-interval-v1.0",
)
require(
    "runtime/backend/app/api/v1/operations.py",
    "系统不会返回模拟健康分、告警、发电量或设备状态",
)
require(
    "runtime/web/src/app/(dashboard)/maintenance/page.tsx",
    "redirect('/projects')",
)
require("runtime/web/src/app/api/dashboard/route.ts", "DASHBOARD_AGGREGATION_UNAVAILABLE")
require("runtime/web/src/app/api/papers/graph/route.ts", "VERIFIED_CITATION_GRAPH_UNAVAILABLE")
require("runtime/web/src/app/api/projects/unlock/route.ts", "VERIFIED_ENTITLEMENT_REQUIRED")
require("runtime/web/src/app/api/projects/[id]/stations/route.ts", "STATION_LIMIT_REACHED")
require("runtime/web/src/app/api/projects/[id]/stations/route.ts", "尚无经验证的 SCADA/IoT 测量数据")
require("runtime/web/src/components/dashboard/site-wizard/SiteWizard.tsx", "/pricing?feature=report-export")
forbid_tree(
    "runtime/backend/app/api/v1",
    (
        "_mock_health_data",
        '"overall_score": round(overall',
        '"capacity_factor": 0.215',
    ),
)
forbid_tree(
    "runtime/web/src/app/api",
    (
        "stationsDb",
        "模拟用户数据汇总",
        "模拟知识图谱数据",
        "reportStatus: 'READY'",
        "power: Math.random()",
    ),
)
require(
    "runtime/backend/app/main.py",
    "v1_operations.router",
)
require(
    "runtime/backend/app/main.py",
    "personalization.router",
)
require(
    "runtime/backend/app/api/v1/ai_assistant.py",
    '@router.post("/chat-json")',
)
for mobile_root in ("android-cn/lib", "ios-cn/lib"):
    forbid_tree(
        mobile_root,
        (
            "http://116.62.32.43",
            "http://localhost:4002",
            "mockData",
            "MockData",
            "Fallback: compute locally",
            "项目已创建",
            "年均GHI: 1456.8",
            "项目IRR: 12.47%",
            "综合健康评分: 82分",
        ),
    )
    require(
        f"{mobile_root}/services/api_service.dart",
        "API_BASE_URL 必须配置为 HTTPS 地址",
    )
    require(
        f"{mobile_root}/screens/resource/compare_screen.dart",
        "真实资源数据暂时不可用，请稍后重试",
    )
    require(
        f"{mobile_root}/screens/ai_assistant/ai_assistant_screen.dart",
        "await ApiService.chat",
    )
    require(
        f"{mobile_root}/screens/finance/storage_finance_screen.dart",
        "await ApiService.calcStorageFinance",
    )
    require(
        f"{mobile_root}/screens/operations/cleaning_screen.dart",
        "await ApiService.calculateCleaningSchedule",
    )

require(
    "runtime/web/src/app/(dashboard)/dashboard/page.tsx",
    "new Set(['chen_xin', 'wang_qiang', 'li_na'])",
)
require(
    "web-global/src/components/dashboard/personalization-preview.ts",
    "new Set(['john_smith', 'sarah_miller'])",
)

service_dockerfiles = sorted((ROOT / "services").glob("*/Dockerfile"))
if len(service_dockerfiles) != 15:
    errors.append(
        f"services: expected 15 production Dockerfiles, found {len(service_dockerfiles)}"
    )
for dockerfile in service_dockerfiles:
    content = dockerfile.read_text(encoding="utf-8")
    service_dir = dockerfile.parent
    source_files = [
        path
        for path in service_dir.rglob("*")
        if path.is_file()
        and path != dockerfile
        and "__pycache__" not in path.parts
    ]
    if not source_files:
        errors.append(
            f"{service_dir.relative_to(ROOT)}: service source and dependency files are missing"
        )
    if len(content.splitlines()) < 12:
        errors.append(
            f"{dockerfile.relative_to(ROOT)}: Dockerfile is an incomplete recovery fragment"
        )
    if dockerfile.parent.name == "gateway":
        continue
    if "FROM python:3.12-slim" not in content:
        errors.append(
            f"{dockerfile.relative_to(ROOT)}: must use the tested Python 3.12 runtime"
        )
    if "USER appuser" not in content:
        errors.append(
            f"{dockerfile.relative_to(ROOT)}: production image must run as appuser"
        )
    if "HEALTHCHECK " not in content:
        errors.append(
            f"{dockerfile.relative_to(ROOT)}: production image needs a health check"
        )

if errors:
    print("Production code gate failed:", file=sys.stderr)
    for error in errors:
        print(f"- {error}", file=sys.stderr)
    raise SystemExit(1)

print("Production code gate passed")
