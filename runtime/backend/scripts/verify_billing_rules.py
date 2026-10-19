"""Local isolated billing verification, no checkout .env or existing database."""
import os
from pathlib import Path
import subprocess
import sys
import tempfile

base = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='energy-billing-verify-') as directory:
    env = {key: os.environ[key] for key in ('PATH', 'HOME', 'TMPDIR', 'LANG') if key in os.environ}
    env.update(PYTHONPATH=str(base), APP_ENV='test', ENVIRONMENT='test', ENERGY_TEST_MODE='1',
               DATABASE_URL='sqlite+aiosqlite:///' + directory + '/test.db',
               SECRET_KEY='local-billing-test-only-at-least-32-characters', MARKET_REGION='cn')
    result = subprocess.run([sys.executable, '-m', 'pytest', '-c', '/dev/null', '--rootdir', str(base), '-q',
                             str(base / 'tests/test_billing_rules.py'), str(base / 'tests/test_billing_rules_http.py'),
                             str(base / 'tests/test_subscription_expiry.py')],
                            cwd=directory, env=env)
    sys.exit(result.returncode)
