/**
 * One list of which tools a model may be offered, and which executor cases stay internal.
 *
 * tools.ts declares six handlers. tool-executor.ts can run those plus many more.
 * Folding the executor switch into the model prompt would offer overseas data tools and
 * maintenance actions that the domestic model call does not send. The names below are the
 * contract: the chat and assistant callers attach only their market subset, and the test
 * checks that subset against the executor switch in both directions.
 */

/** Domestic edition never attaches tools. The backend chat call sends messages only. */
export const CN_MODEL_TOOLS = [] as const;

/** Non-CN SiliconFlow chat (qianwen.ts) offers the six handlers in tools.ts. */
export const SILICONFLOW_CHAT_TOOLS = [
    'calculate',
    'query_policy',
    'get_electricity_price',
    'compare_scenarios',
    'generate_report',
    'get_project_next_steps',
] as const;

/** Non-CN assistant agent offers this shorter operational set, not the six above. */
export const ASSISTANT_AGENT_TOOLS = [
    'geocode_address',
    'get_solar_resource',
    'calculate_solar',
    'search_papers',
    'compare_locations',
    'generate_resource_report',
    'diagnose_system_health',
    'query_knowledge_base',
] as const;

/**
 * Top-level executeTool cases that are not attached to a model call.
 * Nested switches (inspection/cleaning/repair, daily/monthly/quarterly/annual,
 * rental/equity/revenue_share/hybrid) are arguments, not tools.
 */
export const INTERNAL_EXECUTOR_TOOLS = [
    'detect_el_defects',
    'analyze_vibration',
    'analyze_blade_health',
    'monitor_storage_soh',
    'monitor_storage_thermal',
    'analyze_storage_consistency',
    'search_safety_regulations',
    'get_wind_resource',
    'get_current_weather',
    'get_weather_forecast',
    'get_pv_forecast',
    'get_historical_data',
    'get_carbon_intensity',
    'get_air_quality',
    'get_uv_index',
    'reverse_geocode',
    'search_nearby_pois',
    'get_nrel_solar_resource',
    'get_climate_data',
    'get_sun_path',
    'calculate_wind',
    'calculate_storage',
    'compare_solar_wind',
    'explain_site_recommendation',
    'simulate_cooperation',
    'recommend_cleaning',
    'analyze_strings',
    'analyze_iv_curve',
    'generate_work_permit',
    'predict_maintenance',
    'recommend_maintenance_window',
    'diagnose_fault',
    'generate_inspection_plan',
    'calculate_downtime_loss',
    'get_paper_detail',
    'get_paper_pdf',
    'get_paper_citations',
    'generate_paper_summary',
    'extract_paper_data',
    'generate_citation',
    'search_author',
    'get_trending_papers',
    'get_paper_recommendations',
    'search_arxiv',
] as const;

export type ToolMarket = 'cn' | 'global';
export type ToolSurface = 'chat' | 'assistant';

/** Names actually placed on a model request for this market and caller. */
export function modelToolNames(market: ToolMarket, surface: ToolSurface): readonly string[] {
    if (market === 'cn') return CN_MODEL_TOOLS;
    return surface === 'assistant' ? ASSISTANT_AGENT_TOOLS : SILICONFLOW_CHAT_TOOLS;
}
