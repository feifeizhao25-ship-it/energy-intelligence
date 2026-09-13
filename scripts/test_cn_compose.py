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
        self.assertEqual(set(self.cn['services']), {'postgres', 'redis', 'backend', 'web-cn', 'gateway'})
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
        for key in ('OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'OPENROUTER_API_KEY', 'STRIPE_SECRET_KEY'):
            self.assertNotIn(key, env)
        for key in ('DASHSCOPE_API_KEY', 'DEEPSEEK_API_KEY', 'GLM_API_KEY', 'ALIPAY_PRIVATE_KEY'):
            self.assertIn(key, env)

    def test_domestic_runtime_database_and_build_security_retained(self):
        for name in ('postgres', 'redis', 'web-cn'):
            self.assertEqual(self.cn['services'][name], self.source['services'][name])
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
