#!/usr/bin/env node
/**
 * 从后端权益注册表（唯一事实源 runtime/backend/data/entitlements.json）
 * 同步副本到 web 端 src/lib/entitlements/entitlements.json，供定价页构建期注入。
 *
 * 用法：node scripts/sync-entitlements.mjs [--check]
 *   --check  只校验副本与源一致（CI/测试用），不一致时退出码 1。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SOURCE = path.join(webRoot, '..', 'backend', 'data', 'entitlements.json');
const TARGET = path.join(webRoot, 'src', 'lib', 'entitlements', 'entitlements.json');

const source = fs.readFileSync(SOURCE, 'utf8');
// 校验源是合法 JSON 且含必需档位，避免把坏数据同步进构建
const parsed = JSON.parse(source);
for (const tier of ['free', 'pro', 'team', 'enterprise']) {
  if (!parsed.tiers?.[tier]) {
    console.error(`源注册表缺少必需档位: ${tier}`);
    process.exit(1);
  }
}

if (process.argv.includes('--check')) {
  const current = fs.existsSync(TARGET) ? fs.readFileSync(TARGET, 'utf8') : '';
  if (current !== source) {
    console.error('web 副本与后端注册表不一致，请运行 node scripts/sync-entitlements.mjs');
    process.exit(1);
  }
  console.log('entitlements 副本与后端注册表一致');
  process.exit(0);
}

fs.mkdirSync(path.dirname(TARGET), { recursive: true });
fs.writeFileSync(TARGET, source);
console.log(`已同步 ${SOURCE} -> ${TARGET}`);
