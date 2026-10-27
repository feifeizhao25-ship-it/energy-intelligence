"""Jurisdiction exclusion must precede ranking and model context assembly."""
from datetime import date
import pytest
from app.services.rag_service import RAGService, _detect_countries
from app.api.v1 import ai_assistant as endpoint


def corpus():
    rows=[]
    for ident,country in [('cn','cn'),('us','us'),('unknown',None)]:
        row=dict(source_id=ident,lang='cn',title='光伏政策',content=f'光伏政策 marker-{ident}',year=2026,last_verified_at=date.today().isoformat())
        if country:
            row['applicability']={'status':'reviewed','countries':[country]}
        rows.append(row)
    return rows

@pytest.mark.parametrize('query,expected',[('美国光伏政策',['us']),('中国光伏政策',['cn']),('日本光伏政策',[]),('中国美国光伏政策',['cn','us'])])
def test_rag_explicit_country_filters_before_limit(query,expected):
    hits=RAGService(corpus=corpus()).search(query,top_k=10).hits
    assert [h.source_id for h in hits]==expected
    assert all(h.metadata['countries']==[h.source_id] for h in hits)

@pytest.mark.parametrize('query',['americanization','chinaware','germanys','japanese'])
def test_rag_country_substrings_do_not_create_scope(query):
    assert _detect_countries(query,'cn')==set()

@pytest.mark.parametrize('scope',[None,{}, {'status':'reviewed','countries':'us'}, {'status':'pending','countries':['us']}, {'status':'reviewed','countries':['US']}])
def test_rag_unknown_or_malformed_scope_excluded(scope):
    row=corpus()[0];row['applicability']=scope
    assert RAGService(corpus=[row]).search('美国光伏').hits==[]

def test_rag_unscoped_query_preserves_unknown_without_claiming_country():
    hit=RAGService(corpus=[corpus()[-1]]).search('光伏').hits[0]
    assert hit.metadata['countries']==[]
    assert hit.metadata['applicability_status']=='unknown'

@pytest.mark.asyncio
async def test_rag_country_exclusion_reaches_http_and_model(client,auth_headers,monkeypatch):
    monkeypatch.setattr(endpoint,'_RAG_SERVICE',RAGService(corpus=corpus()))
    monkeypatch.setattr(endpoint,'_llm_configured',lambda:True)
    prompts=[]
    async def model(prompt,system):
        prompts.append(prompt)
        return '测试结果 [us]'
    monkeypatch.setattr(endpoint.ai_assistant,'chat_openai',model)
    response=await client.post('/api/v1/ai/ask',json={'question':'美国光伏政策','top_k':1},headers=auth_headers)
    assert response.status_code==200,response.text
    data=response.json()['data']
    assert [s['source_id'] for s in data['sources']]==['us']
    assert data['sources'][0]['countries']==['us']
    assert 'marker-us' in prompts[0]
    assert 'marker-cn' not in prompts[0] and 'marker-unknown' not in prompts[0]
