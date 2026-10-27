"""Explicit review holds override freshness, ranking and corroboration."""
from datetime import date
import pytest
from app.services.rag_service import RAGService
from app.services.rag_sources import SourceRegistry, verification_status
from app.services.rag_refresh import refresh_report
from app.api.v1 import ai_assistant as endpoint


def doc(ident, status='approved'):
    return dict(source_id=ident,title='储能政策',content=f'储能 marker-{ident}',lang='cn',type='policy',year=2026,last_verified_at=date.today().isoformat(),verify_interval_days=30,source_org=ident,source_url='https://example.org/'+ident,license_note='fixture',evidence_review={'status':status})

@pytest.mark.parametrize('review',[{'status':'pending'},{'status':'quarantined'},{'status':'typo'},None,[]])
@pytest.mark.parametrize('include_stale',[False,True])
def test_rag_review_hold_cannot_be_bypassed(review,include_stale):
    blocked=doc('blocked');blocked['evidence_review']=review
    hits=RAGService(corpus=[blocked,doc('allowed')]).search('储能',top_k=1,include_stale=include_stale).hits
    assert [h.source_id for h in hits]==['allowed']


def test_rag_legacy_is_explicitly_unreviewed():
    legacy=doc('legacy');del legacy['evidence_review']
    hit=RAGService(corpus=[legacy]).search('储能').hits[0]
    assert hit.metadata['evidence_status']=='legacy_unreviewed'


def test_rag_quarantined_reference_cannot_corroborate():
    source=doc('source');source['corroborated_by']=['other']
    registry=SourceRegistry([source,doc('other','quarantined')])
    assert verification_status(source,registry)=='single_source'
    assert verification_status(registry.get('other'),registry)=='blocked'


def test_rag_review_queue_is_independent_of_freshness():
    registry=SourceRegistry([doc('held','pending'),doc('ok')])
    report=refresh_report(registry=registry)
    assert report['refresh_needed']==[]
    assert report['evidence_review_needed']==['held']
    assert report['entries'][0]['retrieval_allowed_by_review'] is False


@pytest.mark.asyncio
async def test_rag_review_hold_reaches_http_and_model(client,auth_headers,monkeypatch):
    monkeypatch.setattr(endpoint,'_RAG_SERVICE',RAGService(corpus=[doc('held','quarantined'),doc('allowed')]))
    monkeypatch.setattr(endpoint,'_llm_configured',lambda:True)
    prompts=[]
    async def model(prompt,system):
        prompts.append(prompt)
        return '测试结果 [allowed]'
    monkeypatch.setattr(endpoint.ai_assistant,'chat_openai',model)
    response=await client.post('/api/v1/ai/ask',json={'question':'储能','top_k':1},headers=auth_headers)
    assert response.status_code==200,response.text
    data=response.json()['data']
    assert [s['source_id'] for s in data['sources']]==['allowed']
    assert data['sources'][0]['evidence_status']=='approved'
    assert 'marker-held' not in prompts[0] and 'marker-allowed' in prompts[0]


@pytest.mark.parametrize('change',[
    {'reviewed_claim_ids':['different-claim']},
    {'reviewed_claim_ids':'claim-1'},
    {'last_verified_at':'2000-01-01'},
    {'evidence_review':{'status':'pending'}},
    {'source_org':''},
    {'source_org':'primary'},
])
def test_rag_shared_claim_gate_rejects_insufficient_evidence(change):
    primary=doc('primary');other=doc('other')
    primary['corroborated_by']=['other']
    primary['reviewed_claim_ids']=other['reviewed_claim_ids']=['claim-1']
    other.update(change)
    assert verification_status(primary,SourceRegistry([primary,other]))=='single_source'
