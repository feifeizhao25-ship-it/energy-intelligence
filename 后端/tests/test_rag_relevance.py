"""Independent retrieval expectations for natural Chinese and unsupported queries."""
from datetime import date
import pytest
from app.services.rag_service import RAGService


def doc(ident,title,content,lang='cn'):
 return dict(source_id=ident,title=title,content=content,lang=lang,year=2026,last_verified_at=date.today().isoformat(),verify_interval_days=30)

@pytest.fixture
def service():
 return RAGService(corpus=[doc('pv','光伏发电站设计规范','组件布置、间距与电气设计要求。'),doc('storage','储能建设说明','电池寿命与充放电循环。')])

@pytest.mark.parametrize('query',['请问光伏组件布置有哪些要求？','光伏发电站的间距应该怎么设计'])
def test_natural_chinese_retrieves_expected_document(service,query):
 assert service.search(query,top_k=1).hits[0].source_id=='pv'
 assert service.search(query,top_k=1).hits[0].score>0

@pytest.mark.parametrize('query',['','？？？','火星移民签证'])
def test_unsupported_query_has_no_evidence(service,query):
 assert service.search(query).hits==[]

@pytest.mark.parametrize('k',[0,-1])
def test_nonpositive_limit_returns_empty(service,k):
 assert service.search('光伏',top_k=k).hits==[]

def test_english_terms_do_not_match_substrings():
 service=RAGService(corpus=[doc('false','Solar planning','scapegoat',lang='en'),doc('cap','Capacity rules','cap limit',lang='en')])
 assert [h.source_id for h in service.search('cap',market='global').hits]==['cap']
