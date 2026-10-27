"""Exercise freshness filtering through HTTP, authentication and quota storage."""
from datetime import date, timedelta
import pytest
from app.api.v1 import ai_assistant as endpoint
from app.services.rag_service import RAGService


@pytest.mark.asyncio
@pytest.mark.parametrize('generated',[False,True],ids=['retrieval-only','model-context'])
async def test_ask_excludes_invalid_dates_from_sources_and_model_context(client,auth_headers,monkeypatch,generated):
    today=date.today()
    corpus=[]
    for ident,verified in [('current',today.isoformat()),('future',(today+timedelta(days=1)).isoformat()),('expired',(today-timedelta(days=31)).isoformat()),('invalid','invalid-date')]:
        corpus.append(dict(source_id=ident,lang='cn',title='光伏',content=f'光伏 marker-{ident}',year=today.year,last_verified_at=verified,verify_interval_days=30))
    monkeypatch.setattr(endpoint,'_RAG_SERVICE',RAGService(corpus=corpus))
    monkeypatch.setattr(endpoint,'_llm_configured',lambda:generated)
    prompts=[]
    async def model(prompt,system):
        prompts.append(prompt)
        return '测试模型返回 [current]'
    monkeypatch.setattr(endpoint.ai_assistant,'chat_openai',model)
    response=await client.post('/api/v1/ai/ask',json={'question':'光伏','top_k':10},headers=auth_headers)
    assert response.status_code==200,response.text
    data=response.json()['data']
    assert [s['source_id'] for s in data['sources']]==['current']
    assert [s['source_id'] for s in data['passages']]==['current']
    assert data['generated'] is generated
    assert len(prompts)==int(generated)
    if generated:
        assert 'marker-current' in prompts[0]
        assert all(f'marker-{ident}' not in prompts[0] for ident in ('future','expired','invalid'))
    else:
        assert data['answer'] is None

@pytest.mark.asyncio
async def test_natural_chinese_question_reaches_relevant_evidence(client,auth_headers,monkeypatch):
    corpus=[dict(source_id='pv-layout',lang='cn',title='光伏发电站设计规范',content='组件布置、间距与电气设计要求。',year=2026,last_verified_at=date.today().isoformat(),verify_interval_days=30)]
    monkeypatch.setattr(endpoint,'_RAG_SERVICE',RAGService(corpus=corpus))
    monkeypatch.setattr(endpoint,'_llm_configured',lambda:False)
    response=await client.post('/api/v1/ai/ask',json={'question':'请问光伏组件布置有哪些要求？'},headers=auth_headers)
    assert response.status_code==200
    data=response.json()['data']
    assert [s['source_id'] for s in data['sources']]==['pv-layout']
    assert data['answer'] is None and data['generated'] is False
