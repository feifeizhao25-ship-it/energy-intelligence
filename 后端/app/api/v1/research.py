'''Research API — paper search, trend data, technology insights.'''
from datetime import datetime, timezone
from typing import Optional
import httpx
from fastapi import APIRouter, Depends, Query
from app.core.dependencies import get_current_user_id

router = APIRouter(prefix='/research')

async def search_arxiv(q: str, max_results: int = 10) -> list:
    try:
        url = 'https://export.arxiv.org/api/query'
        params = {
            'search_query': f'all:{q}',
            'start': 0,
            'max_results': max_results,
            'sortBy': 'relevance',
            'sortOrder': 'descending',
        }
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
        text = resp.text
        papers = []
        entries = text.split('<entry>')
        for entry in entries[1:]:
            try:
                title = entry.split('<title>')[1].split('</title>')[0].strip().replace('\n', ' ')
                authors_raw = entry.split('<author>')[1:4] if '<author>' in entry else []
                authors = ', '.join([a.split('<name>')[1].split('</name>')[0] if '<name>' in a else '' for a in authors_raw])
                abstract = entry.split('<summary>')[1].split('</summary>')[0].strip()[:300] if '<summary>' in entry else ''
                published = entry.split('<published>')[1].split('</published>')[0][:4] if '<published>' in entry else '2024'
                papers.append({
                    'id': entry.split('<id>')[1].split('</id>')[0].split('/')[-1] if '<id>' in entry else '',
                    'title': title[:200],
                    'authors': authors[:100],
                    'year': int(published[:4]),
                    'citations': 0,
                    'abstract': abstract,
                    'doi': None,
                    'url': entry.split('<id>')[1].split('</id>')[0] if '<id>' in entry else '',
                    'journal': 'arXiv preprint',
                    'keywords': [q.lower()],
                })
            except Exception:
                continue
        return papers[:max_results]
    except Exception:
        return []

@router.get('/papers')
async def search_papers(
    q: str = Query(..., min_length=2, description='Search query'),
    year_from: Optional[int] = Query(None, ge=2000, le=2030),
    year_to: Optional[int] = Query(None, ge=2000, le=2030),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    user_id: str = Depends(get_current_user_id),
):
    papers = await search_arxiv(q, max_results=30)
    if year_from:
        papers = [p for p in papers if p['year'] >= year_from]
    if year_to:
        papers = [p for p in papers if p['year'] <= year_to]
    papers.sort(key=lambda x: x.get('citations', 0), reverse=True)
    total = len(papers)
    start = (page - 1) * page_size
    items = papers[start: start + page_size]
    return {
        'items': items,
        'total': total,
        'page': page,
        'page_size': page_size,
        'pages': max(1, (total + page_size - 1) // page_size),
        'source': 'arxiv',
    }

@router.get('/trends')
async def get_trends(
    metric: str = Query('lcoe_solar', pattern='^(lcoe_solar|lcoe_wind|capacity_gw|investment_usd)$'),
    period: str = Query('5y', pattern='^(1y|3y|5y|10y)$'),
    user_id: str = Depends(get_current_user_id),
):
    _TREND_DATA = {
        'lcoe_solar': {'unit': 'USD/MWh', 'series': [
            {'year':2015,'value':115.0,'yoy_change':-15.2},{'year':2016,'value':95.0,'yoy_change':-17.4},
            {'year':2017,'value':79.0,'yoy_change':-16.8},{'year':2018,'value':66.0,'yoy_change':-16.5},
            {'year':2019,'value':55.0,'yoy_change':-16.7},{'year':2020,'value':45.0,'yoy_change':-18.2},
            {'year':2021,'value':38.0,'yoy_change':-15.6},{'year':2022,'value':41.0,'yoy_change':7.9},
            {'year':2023,'value':36.0,'yoy_change':-12.2},{'year':2024,'value':32.0,'yoy_change':-11.1},
        ]},
        'lcoe_wind': {'unit': 'USD/MWh', 'series': [
            {'year':2015,'value':64.0,'yoy_change':-8.5},{'year':2016,'value':59.0,'yoy_change':-7.8},
            {'year':2017,'value':54.0,'yoy_change':-8.5},{'year':2018,'value':50.0,'yoy_change':-7.4},
            {'year':2019,'value':46.0,'yoy_change':-8.0},{'year':2020,'value':42.0,'yoy_change':-8.7},
            {'year':2021,'value':38.0,'yoy_change':-9.5},{'year':2022,'value':40.0,'yoy_change':5.3},
            {'year':2023,'value':37.0,'yoy_change':-7.5},{'year':2024,'value':34.0,'yoy_change':-8.1},
        ]},
        'capacity_gw': {'unit': 'GW', 'series': [
            {'year':2015,'value':227.0,'yoy_change':28.5},{'year':2016,'value':295.0,'yoy_change':29.9},
            {'year':2017,'value':395.0,'yoy_change':33.9},{'year':2018,'value':505.0,'yoy_change':27.8},
            {'year':2019,'value':627.0,'yoy_change':24.2},{'year':2020,'value':773.0,'yoy_change':23.3},
            {'year':2021,'value':942.0,'yoy_change':21.9},{'year':2022,'value':1185.0,'yoy_change':25.8},
            {'year':2023,'value':1608.0,'yoy_change':35.7},{'year':2024,'value':2150.0,'yoy_change':33.7},
        ]},
        'investment_usd': {'unit': 'USD billion', 'series': [
            {'year':2015,'value':286.0,'yoy_change':4.4},{'year':2016,'value':297.0,'yoy_change':3.8},
            {'year':2017,'value':324.0,'yoy_change':9.1},{'year':2018,'value':332.0,'yoy_change':2.5},
            {'year':2019,'value':363.0,'yoy_change':9.3},{'year':2020,'value':389.0,'yoy_change':7.2},
            {'year':2021,'value':472.0,'yoy_change':21.3},{'year':2022,'value':558.0,'yoy_change':18.2},
            {'year':2023,'value':623.0,'yoy_change':11.6},{'year':2024,'value':712.0,'yoy_change':14.3},
        ]},
    }
    data = _TREND_DATA.get(metric, _TREND_DATA['lcoe_solar'])
    year_cutoff = {'1y': 2024, '3y': 2022, '5y': 2020, '10y': 2015}[period]
    filtered = [s for s in data['series'] if s['year'] >= year_cutoff]
    return {
        'metric': metric, 'unit': data['unit'], 'period': period,
        'series': filtered,
        'source': 'IEA WEO 2024, IRENA, BNEF',
        'updated_at': datetime.now(timezone.utc).isoformat(),
    }

@router.get('/market-trends')
async def market_trends(
    region: str = Query('global'),
    user_id: str = Depends(get_current_user_id),
):
    return {
        'region': region,
        'solar_capex_2024_usd_per_mw': 850000,
        'wind_capex_2024_usd_per_mw': 1350000,
        'battery_prices_usd_per_kwh': 98,
        'battery_price_trend': 'declining 12% YoY',
        'policy_support': 'strong — IRA (US), REPowerEU, GBI (China)',
        'global_capacity_gw_2024': 2150,
        'annual_investment_bn_usd_2024': 712,
        'china_solar_capacity_gw_2024': 780,
        'china_wind_capacity_gw_2024': 510,
        'top_companies': ['隆基绿能 (LONGi)', '通威太阳能', '阳光电源', '晶科能源', '天合光能', '金风科技'],
        'source': 'IEA WEO 2024, BNEF, CIPA',
        'updated_at': datetime.now(timezone.utc).isoformat(),
    }

@router.get('/technologies/{tech_type}')
async def technology_info(
    tech_type: str,
    user_id: str = Depends(get_current_user_id),
):
    tech_db = {
        'solar': {'technology':'Utility-Scale Solar PV','description':'Photovoltaic systems.','maturity':'commercial','typical_efficiency':0.225,'cost_per_kw_2024':850,'lcoe_usd_per_mwh_2024':32,'lifespan_years':30,'capacity_factor_range':'0.15–0.35','global_installed_gw':1850,'top_efficiency_cells':'TOPCon 26.5%, HJT 27.3%, PERC 23.5%'},
        'wind': {'technology':'Onshore Wind','description':'Wind turbines.','maturity':'commercial','cost_per_kw_2024':1350,'lcoe_usd_per_mwh_2024':34,'lifespan_years':25,'capacity_factor_range':'0.25–0.50','global_installed_gw':1170,'largest_turbine_mw':18},
        'offshore_wind': {'technology':'Offshore Wind','description':'Marine wind turbines.','maturity':'commercial','cost_per_kw_2024':3200,'lcoe_usd_per_mwh_2024':78,'lifespan_years':25,'capacity_factor_range':'0.40–0.55','global_installed_gw':75,'largest_turbine_mw':18},
        'storage': {'technology':'Battery Energy Storage (BESS)','description':'Grid-scale lithium-ion storage.','maturity':'commercial','typical_efficiency':0.90,'cost_per_kwh_2024':98,'lcoe_usd_per_mwh_2024':85,'lifespan_years':15,'global_installed_gwh':185,'dominant_chemistry':'LFP'},
    }
    info = tech_db.get(tech_type.lower())
    if not info:
        return {'technology': tech_type, 'description': 'Technology data not available'}
    return info
