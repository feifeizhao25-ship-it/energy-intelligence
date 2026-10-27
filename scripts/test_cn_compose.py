#!/usr/bin/env python3
import copy
import unittest
import os
import re
import shutil
import subprocess
import yaml
from render_cn_compose import ROOT, domestic_config

class DomesticComposeTests(unittest.TestCase):
    def setUp(self):
        self.source = yaml.safe_load((ROOT / 'runtime/docker-compose.production.yml').read_text())
        self.before = copy.deepcopy(self.source)
        self.cn = domestic_config(self.source)

    def test_domestic_only_and_no_source_mutation(self):
        self.assertEqual(self.source, self.before)
        self.assertEqual(set(self.cn['services']), {'postgres', 'redis', 'backend', 'web-cn', 'gateway', 'celery-worker', 'celery-beat', 'membership-cron'})
        self.assertNotIn('INT_DOMAIN', str(self.cn))
        self.assertNotIn('web-int', str(self.cn))
        self.assertNotEqual(self.cn['name'], self.source['name'])

    def test_gateway_keeps_tls_and_domestic_health_dependency(self):
        gateway = self.cn['services']['gateway']
        self.assertEqual(gateway['ports'], self.source['services']['gateway']['ports'])
        self.assertEqual(gateway['depends_on'], {'web-cn': {'condition': 'service_healthy'}})
        self.assertIn('./Caddyfile.cn:/etc/caddy/Caddyfile:ro', gateway['volumes'])

    def test_no_foreign_provider_credentials_and_domestic_payment_retained(self):
        env = self.cn['services']['backend']['environment']
        for key in ('OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'OPENROUTER_API_KEY', 'STRIPE_SECRET_KEY', 'SENTRY_DSN'):
            self.assertNotIn(key, env)
        self.assertEqual(env['APP_EDITION'], 'cn')
        self.assertEqual(env['NENGJIAN_OVERSEAS_LIVE'], 'disabled')
        for key in ('DASHSCOPE_API_KEY', 'DEEPSEEK_API_KEY', 'GLM_API_KEY', 'ALIPAY_PRIVATE_KEY'):
            self.assertIn(key, env)
        self.assertIn('database', str(self.cn['services']['backend']['healthcheck']))
        self.assertIn('celery', ' '.join(self.cn['services']['celery-worker']['command']))
        self.assertIn('beat', ' '.join(self.cn['services']['celery-beat']['command']))
        self.assertEqual(self.cn['services']['celery-beat']['healthcheck'], {'disable': True})
        self.assertIn('CRON_SECRET', self.cn['services']['membership-cron']['environment'])
        self.assertNotIn('STRIPE_SECRET_KEY', self.cn['services']['celery-worker']['environment'])

    def test_domestic_runtime_database_and_build_security_retained(self):
        for name in ('postgres', 'redis'):
            self.assertEqual(self.cn['services'][name], self.source['services'][name])
        web = self.cn['services']['web-cn']['environment']
        source_web = self.source['services']['web-cn']['environment']
        self.assertNotIn('OPENALEX_CONTACT_EMAIL', web)
        self.assertIn('OPENALEX_CONTACT_EMAIL', source_web)
        self.assertNotIn('SILICONFLOW_API_KEY', web)
        self.assertNotIn('OPENWEATHERMAP_API_KEY', web)
        self.assertEqual(web['APP_EDITION'], 'cn')
        self.assertIn('NENGJIAN_INTERNAL_TOKEN', web)
        backend = self.cn['services']['backend']['environment']
        for key in ('NENGJIAN_WECOM_CORP_ID', 'NENGJIAN_WECOM_AGENT_ID', 'NENGJIAN_WECOM_SECRET',
                    'NENGJIAN_GEO_QWEN_API_KEY', 'NENGJIAN_BAIDU_PUSH_TOKEN', 'NENGJIAN_RERANK_URL',
                    'NENGJIAN_INTERNAL_TOKEN', 'WECOM_TPL_POLICY', 'WECOM_TPL_FINANCE'):
            self.assertIn(key, backend)
        self.assertEqual(backend['GLM_MODEL'], 'glm-4.7-flash')
        self.assertEqual(self.cn['volumes'], self.source['volumes'])

    def test_actual_compose_config_without_international_variables(self):
        executable = shutil.which('docker-compose')
        if not executable:
            self.skipTest('standalone docker-compose unavailable')
        compose_file = ROOT / 'runtime/docker-compose.cn.production.yml'
        required = set(re.findall(r'\$\{([A-Z][A-Z0-9_]*):\?', compose_file.read_text()))
        env = {'PATH': os.environ.get('PATH', ''), **{key: 'validation-only' for key in required}}
        env['IMAGE_REGISTRY'] = 'registry.example.test/energy'
        self.assertNotIn('INT_DOMAIN', env)
        result = subprocess.run([executable, '--env-file', '/dev/null', '-f', str(compose_file), 'config', '--quiet'],
            env=env, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, 'Compose rejected domestic topology; no real credentials were supplied')

if __name__ == '__main__':
    unittest.main()
