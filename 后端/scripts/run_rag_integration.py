"""Use an isolated cwd/environment/database; never load the checkout's .env."""
from pathlib import Path
import os,subprocess,tempfile,sys
base=Path(__file__).resolve().parents[1]
python=Path(sys.executable)
with tempfile.TemporaryDirectory(prefix='energy-rag-integration-') as tmp:
    env={k:os.environ[k] for k in ('PATH','HOME','TMPDIR','LANG') if k in os.environ}
    env.update(PYTHONPATH=str(base),APP_ENV='test',ENVIRONMENT='test',ENERGY_TEST_MODE='1',DATABASE_URL='sqlite+aiosqlite:///'+tmp+'/test.db',SECRET_KEY='local-integration-only-not-a-production-secret-2026',MARKET_REGION='cn')
    args=[str(python),'-m','pytest','-c','/dev/null','--rootdir',str(base),'-q',str(base/'tests/test_rag_sources.py'),str(base/'tests/test_rag_relevance.py'),str(base/'tests/test_rag_geography.py'),str(base/'tests/test_rag_evidence_review.py'),str(base/'tests/test_rag_freshness_language.py'),str(base/'tests/test_rag_api_freshness.py'),str(base/'tests/test_business_apis.py'),'-k','rag or ai_ask']
    result=subprocess.run(args,cwd=tmp,env=env,capture_output=True,text=True)
    output=result.stdout+result.stderr
    print(output)
    sys.exit(result.returncode)
