async def _get_report_issues(report_type: str, project_id: str, db: AsyncSession) -> list:
    return []


def _mock_report_issues(report_type: str) -> list:
    """Compatibility fixtures used by legacy tests and offline demos."""
    issue_sets = {
        "health": [
            {
                "type": "soiling",
                "severity": "medium",
                "description": "Module soiling is reducing array yield.",
                "recommendation": "Schedule cleaning and compare PR before and after service.",
            },
            {
                "type": "degradation",
                "severity": "low",
                "description": "Observed PR is slightly below the expected benchmark.",
                "recommendation": "Monitor weekly trend and validate irradiance sensor calibration.",
            },
        ],
        "anomaly": [
            {
                "type": "underperformance",
                "severity": "high",
                "description": "String-level output is below peer-group baseline.",
                "recommendation": "Inspect affected strings and review inverter event logs.",
            },
            {
                "type": "shading",
                "severity": "medium",
                "description": "Midday clipping pattern suggests transient shading.",
                "recommendation": "Run drone inspection and update shading-loss assumptions.",
            },
        ],
        "equipment": [
            {
                "type": "inverter",
                "severity": "high",
                "description": "Inverter telemetry shows repeated thermal derating.",
                "recommendation": "Check ventilation, firmware, and cabinet temperature sensors.",
            },
            {
                "type": "module",
                "severity": "medium",
                "description": "Module mismatch risk is elevated on one combiner segment.",
                "recommendation": "Run IV-curve sampling on the flagged segment.",
            },
        ],
        "cleaning": [
            {
                "type": "cleaning",
                "severity": "medium",
                "description": "Cleaning uplift estimate exceeds the economic trigger.",
                "recommendation": "Book cleaning during the next low-irradiance maintenance window.",
            }
        ],
    }
    return issue_sets.get(report_type, issue_sets["health"])


def _calculate_failure_probability(
