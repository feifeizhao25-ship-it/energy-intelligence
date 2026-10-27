#!/usr/bin/env python3
"""Generate the domestic-only topology from the shared runtime contract."""
from pathlib import Path
import argparse
import copy
import yaml

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / 'runtime/docker-compose.cn.production.yml'
CADDY = ROOT / 'runtime/Caddyfile.cn'


def domestic_config(source):
    config = copy.deepcopy(source)
    config['name'] = 'energy-intelligence-cn'
    config['services'].pop('web-int')
    gateway = config['services']['gateway']
    gateway['environment'].pop('INT_DOMAIN')
    gateway['depends_on'].pop('web-int')
    gateway['volumes'] = [mount.replace('./Caddyfile:', './Caddyfile.cn:') for mount in gateway['volumes']]
    # 国内部署不注入国际支付与海外模型凭据。
    environment = config['services']['backend']['environment']
    for key in ('OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'OPENROUTER_API_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'SENDGRID_API_KEY', 'SENTRY_DSN'):
        environment.pop(key, None)
    environment['APP_EDITION'] = 'cn'
    environment['NENGJIAN_OVERSEAS_LIVE'] = 'disabled'
    environment['NENGJIAN_NASA_BATCH_IMPORT'] = '${NENGJIAN_NASA_BATCH_IMPORT:-0}'
    environment['DASHSCOPE_MODEL'] = 'qwen3.5-plus'
    environment['DEEPSEEK_MODEL'] = 'deepseek-flash'
    for key in (
        'NENGJIAN_DEEPSEEK_API_KEY', 'NENGJIAN_DASHSCOPE_API_KEY', 'NENGJIAN_GLM_API_KEY',
        'NENGJIAN_GUARDRAIL_AK_ID', 'NENGJIAN_GUARDRAIL_AK_SECRET', 'NENGJIAN_GUARDRAIL_ENDPOINT',
        'NENGJIAN_ARK_API_KEY', 'NENGJIAN_ARK_BASE_URL',
        'NENGJIAN_SEEDREAM_MODEL', 'NENGJIAN_SEEDANCE_MODEL',
        'NENGJIAN_EMBEDDING_MODEL', 'NENGJIAN_RERANK_MODEL', 'NENGJIAN_RERANK_URL',
        'NENGJIAN_WECOM_CORP_ID', 'NENGJIAN_WECOM_AGENT_ID', 'NENGJIAN_WECOM_SECRET',
        'NENGJIAN_WECOM_TOKEN', 'NENGJIAN_WECOM_AES_KEY', 'NENGJIAN_WECOM_CREATOR',
        'NENGJIAN_WECOM_ROBOT_KEY',
        'WECOM_TPL_CONTENT', 'WECOM_TPL_BUSINESS', 'WECOM_TPL_COMPLIANCE', 'WECOM_TPL_PROMOTION',
        'WECOM_TPL_SWITCH', 'WECOM_TPL_INCIDENT', 'WECOM_TPL_POLICY', 'WECOM_TPL_FINANCE',
        'WECOM_SHA_CONTROL_ID',
        'NENGJIAN_GEO_QWEN_API_KEY', 'NENGJIAN_GEO_WENXIN_API_KEY', 'NENGJIAN_GEO_DOUBAO_API_KEY',
        'NENGJIAN_GEO_DOUBAO_MODEL', 'NENGJIAN_GEO_WENXIN_MODEL', 'NENGJIAN_GEO_QWEN_MODEL',
        'NENGJIAN_BAIDU_PUSH_TOKEN', 'NENGJIAN_BAIDU_SITE',
        'NENGJIAN_INTERNAL_TOKEN',
        'NENGJIAN_GUARDRAIL_SERVICE',
        'NENGJIAN_KILL_SWITCH',
        'DASHSCOPE_REVIEW_MODEL',
        'NENGJIAN_NASA_GRID', 'NENGJIAN_NASA_POINTS',
        'NENGJIAN_PUBLIC_ORIGIN',
    ):
        environment[key] = '${%s:-}' % key
    environment['NENGJIAN_FEEDBACK_PATH'] = '${NENGJIAN_FEEDBACK_PATH:-/var/lib/nengjian/feedback.jsonl}'
    environment['NENGJIAN_RESOURCE_CACHE'] = '${NENGJIAN_RESOURCE_CACHE:-/var/lib/nengjian/nasa-cache.json}'
    environment['NENGJIAN_POLICY_ALERT_LOG'] = '${NENGJIAN_POLICY_ALERT_LOG:-/var/lib/nengjian/policy-alerts.jsonl}'
    environment['NENGJIAN_POLICY_DB'] = '${NENGJIAN_POLICY_DB:-/var/lib/nengjian/policy.sqlite}'
    environment['NENGJIAN_POLICY_PENDING'] = '${NENGJIAN_POLICY_PENDING:-/var/lib/nengjian/policy-pending.json}'
    environment['NENGJIAN_KILL_FILE'] = '${NENGJIAN_KILL_FILE:-/var/lib/nengjian/kill}'
    environment['CRAWLER_CONTACT_EMAIL'] = '${CRAWLER_CONTACT_EMAIL:?CRAWLER_CONTACT_EMAIL is required}'
    for switch in (
        'PUBLISH_A', 'PUBLISH_B', 'PUBLISH_C', 'BAIDU_PUSH', 'EMAIL_OPT_IN',
        'GITHUB_METHODOLOGY', 'SEO_GENERATE', 'GEO_MONITOR', 'WECOM_SUBMIT', 'MARKETING_MEDIA',
    ):
        environment['NENGJIAN_SWITCH_%s' % switch] = '${NENGJIAN_SWITCH_%s:-}' % switch
    environment['GLM_MODEL'] = 'glm-4.7-flash'
    environment['NENGJIAN_USER_DAILY_BUDGET_CNY'] = '${NENGJIAN_USER_DAILY_BUDGET_CNY:-20}'
    environment['NENGJIAN_USER_MONTHLY_BUDGET_CNY'] = '${NENGJIAN_USER_MONTHLY_BUDGET_CNY:-200}'
    environment['NENGJIAN_MODEL_CALL_CNY'] = '${NENGJIAN_MODEL_CALL_CNY:-0.01}'
    environment['NENGJIAN_BOTTOM_LINE_MODEL_REVIEW'] = '${NENGJIAN_BOTTOM_LINE_MODEL_REVIEW:-0}'
    environment['NENGJIAN_MEDIA_ENABLED'] = '${NENGJIAN_MEDIA_ENABLED:-0}'
    environment['NENGJIAN_OPENCLAW_SECRETS_FILE'] = '${NENGJIAN_OPENCLAW_SECRETS_FILE:-/etc/airui-nengjian/openclaw.env}'
    web = config['services']['web-cn']['environment']
    web.pop('OPENALEX_CONTACT_EMAIL', None)
    web.pop('SILICONFLOW_API_KEY', None)
    web.pop('OPENWEATHERMAP_API_KEY', None)
    web['APP_EDITION'] = 'cn'
    web['NENGJIAN_INTERNAL_TOKEN'] = '${NENGJIAN_INTERNAL_TOKEN:-}'
    web['NENGJIAN_PUBLIC_ORIGIN'] = '${NENGJIAN_PUBLIC_ORIGIN:-}'
    web['CRAWLER_CONTACT_EMAIL'] = '${CRAWLER_CONTACT_EMAIL:?CRAWLER_CONTACT_EMAIL is required}'
    backend = config['services']['backend']
    backend['volumes'] = list(backend.get('volumes') or []) + ['nengjian_shared:/var/lib/nengjian']
    config.setdefault('volumes', {})
    config['volumes']['nengjian_shared'] = {}
    worker = copy.deepcopy(backend)
    worker['command'] = ['celery', '-A', 'app.tasks.celery_app', 'worker', '--loglevel=info', '--concurrency=2', '--pidfile=/tmp/celery-worker.pid']
    worker['healthcheck'] = {
        'test': ['CMD-SHELL', 'celery -A app.tasks.celery_app inspect ping --timeout 5 | grep -q OK'],
        'interval': '30s', 'timeout': '15s', 'retries': 5, 'start_period': '40s',
    }
    worker['depends_on'] = {
        'postgres': {'condition': 'service_healthy'},
        'redis': {'condition': 'service_healthy'},
        'backend': {'condition': 'service_healthy'},
    }
    beat = copy.deepcopy(backend)
    # 只能有一个 beat，否则到期降级会被重复扫描。不要扩成多副本。
    beat['command'] = ['celery', '-A', 'app.tasks.celery_app', 'beat', '--loglevel=info', '--pidfile=/tmp/celery-beat.pid', '--schedule', '/tmp/celerybeat-schedule']
    beat['healthcheck'] = {'disable': True}
    beat['depends_on'] = {
        'postgres': {'condition': 'service_healthy'},
        'redis': {'condition': 'service_healthy'},
        'backend': {'condition': 'service_healthy'},
    }
    config['services']['celery-worker'] = worker
    config['services']['celery-beat'] = beat
    config['services']['membership-cron'] = {
        'image': 'alpine:3.20',
        'restart': 'unless-stopped',
        'command': ['sh', '-c', 'while true; do wget -qO- --header="Authorization: Bearer $$CRON_SECRET" --post-data="" http://web-cn:3000/api/cron/membership >/dev/null || true; sleep 60; done'],
        'environment': {'CRON_SECRET': '${CRON_SECRET:?CRON_SECRET is required}'},
        'depends_on': {'web-cn': {'condition': 'service_healthy'}},
        'networks': ['backend'],
        'read_only': True,
        'tmpfs': ['/tmp:size=32m,mode=1777'],
        'security_opt': ['no-new-privileges:true'],
        'cap_drop': ['ALL'],
    }
    return config


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    source = yaml.safe_load((ROOT / 'runtime/docker-compose.production.yml').read_text())
    config = domestic_config(source)
    caddy_source = (ROOT / 'runtime/Caddyfile').read_text()
    caddy = caddy_source.split('\n{$INT_DOMAIN} {', 1)[0].rstrip() + '\n'
    if args.check:
        if not TARGET.exists() or yaml.safe_load(TARGET.read_text()) != config:
            raise SystemExit('国内 Compose 已偏离主配置，请重新生成并审核')
        if not CADDY.exists() or CADDY.read_text() != caddy:
            raise SystemExit('国内网关已偏离主配置，请重新生成并审核')
        print('国内拓扑与网关一致性检查通过')
    else:
        TARGET.write_text('# Generated by scripts/render_cn_compose.py; review changes before deployment.\n' + yaml.safe_dump(config, allow_unicode=True, sort_keys=False))
        CADDY.write_text(caddy)

if __name__ == '__main__':
    main()
