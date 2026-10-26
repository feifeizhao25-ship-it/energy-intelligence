/**
 * 国内版界面走查。只连本机网页、本机数据库和本机接口，不调用真实短信或支付。
 *
 * 运行前：网页在 3411，后端在 8000，库为 energy_ui。
 *   PLAYWRIGHT_MODULE 指向已安装的 playwright 入口。
 *   DATABASE_URL 必须是 localhost 上的 energy_ui。
 * 截图写到 UI_OUTPUT（默认 /opt/cursor/artifacts/ui-test）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const playwrightModule = process.env.PLAYWRIGHT_MODULE || '/tmp/pw/node_modules/playwright/index.js';
const playwright = await import(playwrightModule);
const chromium = playwright.chromium || playwright.default?.chromium;
const require = createRequire(path.resolve('runtime/web/package.json'));
const { PrismaClient } = require('@prisma/client');

const databaseUrl = process.env.DATABASE_URL || 'postgresql://ubuntu@127.0.0.1:5432/energy_ui';
if (!/energy_ui/.test(databaseUrl) || !/127\.0\.0\.1|localhost/.test(databaseUrl)) {
  throw new Error('拒绝连接非本机 energy_ui 库');
}
const base = process.env.UI_BASE_URL || 'http://127.0.0.1:3411';
const out = process.env.UI_OUTPUT || '/opt/cursor/artifacts/ui-test';
fs.mkdirSync(out, { recursive: true });

const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const report = [];

function record(name, status, detail = '') {
  report.push({ name, status, detail });
  console.log(`${status.toUpperCase()} ${name}${detail ? ' — ' + detail : ''}`);
}

async function shot(page, name) {
  const file = path.join(out, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function dismissTip(page) {
  const hide = page.getByRole('button', { name: '不再显示' });
  if (await hide.count()) await hide.click().catch(() => {});
}

async function login(page, phone) {
  await db.user.updateMany({
    where: { phone },
    data: { profileCompleted: false, plan: 'FREE', planExpireAt: null, dailyAiCalls: 0 },
  });
  await db.verificationCode.deleteMany({ where: { phone } });
  await db.verificationCode.create({
    data: { phone, code: '834927', expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
  });
  await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('请输入 11 位手机号').fill(phone);
  await page.locator('#sms-code').fill('834927');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: '登录 / 注册' }).click();
  await page.waitForURL(/\/(onboarding|dashboard|calculator)/, { timeout: 20000 });
}

async function runViewport(browser, label, width, height, phone) {
  const context = await browser.newContext({
    viewport: { width, height },
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
  });
  const page = await context.newPage();
  const name = (step) => `20261026b-${label}-${step}`;

  try {
    await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.getByText('新能源智库').first().waitFor();
    await shot(page, name('home'));
    record(`${label} 首页`, 'pass');
  } catch (error) {
    await shot(page, name('home-fail')).catch(() => {});
    record(`${label} 首页`, 'fail', error.message);
  }

  try {
    await page.goto(base + '/pricing', { waitUntil: 'domcontentloaded' });
    const text = await page.locator('body').innerText();
    for (const tier of ['免费版', '专业版', '专家版', '团队版', '企业版']) {
      if (!text.includes(tier)) throw new Error('缺少档位 ' + tier);
    }
    for (const price of ['¥0', '¥1980/年', '¥5800/年', '¥16800/年', '¥33000/年']) {
      if (!text.includes(price)) throw new Error('缺少价格 ' + price);
    }
    if (!text.includes('月付已停用')) throw new Error('没有写明月付已停用');
    if (/¥\s*\d+\s*\/\s*月/.test(text)) throw new Error('价格页仍出现月付金额');
    await shot(page, name('pricing'));
    record(`${label} 五档年付价格页`, 'pass');
  } catch (error) {
    await shot(page, name('pricing-fail')).catch(() => {});
    record(`${label} 五档年付价格页`, 'fail', error.message);
  }

  try {
    await page.goto(base + '/privacy', { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: '隐私政策' }).waitFor();
    await shot(page, name('privacy'));
    await page.goto(base + '/terms', { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: '服务条款' }).waitFor();
    await shot(page, name('terms'));
    await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: '联系我们' }).scrollIntoViewIfNeeded();
    await shot(page, name('operator-footer'));
    const footer = await page.locator('footer').innerText();
    record(`${label} 隐私、条款与页脚联系方式`, 'pass', footer.includes('工单中心') ? '未配置对外联系方式，页脚指向工单中心' : '页脚已有联系方式');
  } catch (error) {
    await shot(page, name('legal-fail')).catch(() => {});
    record(`${label} 隐私、条款与页脚联系方式`, 'fail', error.message);
  }

  try {
    await page.goto(base + '/login', { waitUntil: 'domcontentloaded' });
    await page.getByPlaceholder('请输入 11 位手机号').fill('123');
    await page.getByRole('button', { name: '获取验证码' }).click();
    await page.getByText('请输入正确的 11 位手机号').waitFor();
    await shot(page, name('login-invalid-phone'));
    await page.getByPlaceholder('请输入 11 位手机号').fill(phone);
    await page.getByRole('button', { name: '获取验证码' }).click();
    await page.locator('[role=alert], [role=status]').first().waitFor({ timeout: 15000 });
    await shot(page, name('login-sms'));
    const smsText = await page.locator('[role=alert], [role=status]').first().innerText();
    record(`${label} 登录页与短信入口`, 'pass', smsText.slice(0, 80));
  } catch (error) {
    await shot(page, name('login-fail')).catch(() => {});
    record(`${label} 登录页与短信入口`, 'fail', error.message);
  }

  try {
    await login(page, phone);
    await shot(page, name('after-login'));
    record(`${label} 注册登录`, 'pass', page.url());
  } catch (error) {
    await shot(page, name('after-login-fail')).catch(() => {});
    record(`${label} 注册登录`, 'fail', error.message);
    await context.close();
    return;
  }

  if (page.url().includes('/onboarding')) {
    try {
      await shot(page, name('onboarding-welcome'));
      await page.getByRole('button', { name: '继续' }).click();
      await page.getByRole('button', { name: '分布式光伏' }).click();
      await page.getByRole('button', { name: '继续' }).click();
      await page.getByRole('button', { name: '工程师/技术人员' }).click();
      await page.getByRole('button', { name: '继续' }).click();
      await shot(page, name('onboarding-province'));
      await page.getByRole('button', { name: '继续' }).click();
      await page.getByRole('button', { name: '项目收益测算' }).click();
      await page.getByRole('button', { name: '继续' }).click();
      await page.getByText('免费版实际额度如下').waitFor();
      await shot(page, name('onboarding-quota'));
      const quotaText = await page.locator('body').innerText();
      const quotaOk = /每日 AI 对话\s*5/.test(quotaText) && /每日项目测算\s*3/.test(quotaText) && /最多项目数\s*1/.test(quotaText);
      record(`${label} 新手引导额度`, quotaOk ? 'pass' : 'fail', quotaText.match(/每日 AI 对话[\s\S]{0,40}/)?.[0]?.replace(/\s+/g, ' ') || '');
      await page.getByRole('button', { name: '开始使用' }).click();
      await page.waitForURL(/\/calculator/, { timeout: 20000 });
    } catch (error) {
      await shot(page, name('onboarding-fail')).catch(() => {});
      record(`${label} 新手引导`, 'fail', error.message);
    }
  }

  try {
    await page.goto(base + '/calculator/solar', { waitUntil: 'domcontentloaded' });
    await dismissTip(page);
    await page.locator('#lat').fill('39.9');
    await page.locator('#lng').fill('116.4');
    await page.locator('#capacity').fill('100');
    await page.locator('#unitCost').fill('3000');
    await page.locator('#electricityPrice').fill('0.65');
    await page.getByRole('button', { name: '生成估算并保存' }).click();
    await page.getByText('初步估算已保存').waitFor({ timeout: 30000 });
    await shot(page, name('solar'));
    const solarText = await page.locator('body').innerText();
    record(`${label} 光伏测算`, solarText.includes('初步估算已保存') ? 'pass' : 'fail', solarText.replace(/\s+/g, ' ').slice(0, 220));
  } catch (error) {
    await shot(page, name('solar-fail')).catch(() => {});
    record(`${label} 光伏测算`, 'fail', error.message);
  }

  try {
    await page.goto(base + '/calculator/wind', { waitUntil: 'domcontentloaded' });
    await dismissTip(page);
    await page.getByRole('button', { name: '下一步' }).click();
    await page.getByRole('button', { name: '执行计算' }).click();
    await page.getByRole('alert').filter({ hasText: '升级会员' }).waitFor({ timeout: 15000 });
    await shot(page, name('wind-free-blocked'));
    const blocked = await page.getByRole('alert').innerText();
    const user = await db.user.findFirst({ where: { phone } });
    await db.user.update({
      where: { id: user.id },
      data: { plan: 'PRO', planExpireAt: new Date(Date.now() + 365 * 86400000) },
    });
    await page.getByRole('button', { name: '执行计算' }).click();
    await page.waitForURL(/\/calculator\/result/, { timeout: 30000 });
    await page.getByText(/发电量|内部收益率/).first().waitFor({ timeout: 15000 });
    await shot(page, name('wind'));
    const windText = await page.locator('body').innerText();
    record(`${label} 风电测算`, /发电量|内部收益率/.test(windText) ? 'pass' : 'fail', `${blocked.replace(/\s+/g, ' ')} | ${windText.replace(/\s+/g, ' ').slice(0, 180)}`);
    await db.user.update({ where: { id: user.id }, data: { plan: 'FREE', planExpireAt: null } });
  } catch (error) {
    await shot(page, name('wind-fail')).catch(() => {});
    record(`${label} 风电测算`, 'fail', error.message);
  }

  try {
    await page.goto(base + '/projects', { waitUntil: 'domcontentloaded' });
    await dismissTip(page);
    await page.waitForTimeout(800);
    await shot(page, name('projects-empty'));
    record(`${label} 项目空状态`, 'pass', (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 120));
  } catch (error) {
    record(`${label} 项目空状态`, 'fail', error.message);
  }

  try {
    await page.goto(base + '/assistant', { waitUntil: 'domcontentloaded' });
    await dismissTip(page);
    await page.getByPlaceholder('输入您的问题，或描述分析需求...').fill('用普通人能懂的话说明：平准化度电成本是什么，不要预测电价。');
    await page.getByRole('button', { name: '发送' }).click();
    await page.waitForTimeout(4000);
    await shot(page, name('assistant'));
    const aiText = await page.locator('body').innerText();
    record(`${label} AI 问答`, 'pass', aiText.replace(/\s+/g, ' ').slice(-240));
  } catch (error) {
    await shot(page, name('assistant-fail')).catch(() => {});
    record(`${label} AI 问答`, 'fail', error.message);
  }

  try {
    const user = await db.user.findFirst({ where: { phone } });
    await db.user.update({ where: { id: user.id }, data: { dailyAiCalls: 5, lastResetAt: new Date() } });
    await page.goto(base + '/assistant', { waitUntil: 'domcontentloaded' });
    await dismissTip(page);
    await page.getByPlaceholder('输入您的问题，或描述分析需求...').fill('再问一次今天的额度。');
    await page.getByRole('button', { name: '发送' }).click();
    await page.getByText(/次数已用完|暂时不可用|升级会员/).first().waitFor({ timeout: 15000 });
    await shot(page, name('assistant-quota'));
    const quotaText = await page.locator('body').innerText();
    record(`${label} AI 额度用尽`, /次数已用完/.test(quotaText) ? 'pass' : 'fail', quotaText.replace(/\s+/g, ' ').slice(-180));
  } catch (error) {
    await shot(page, name('assistant-quota-fail')).catch(() => {});
    record(`${label} AI 额度用尽`, 'fail', error.message);
  }

  try {
    await page.goto(base + '/checkout?plan=PRO&billing=yearly', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /支付宝支付/ }).click();
    await page.getByText('支付通道暂时不可用').waitFor({ timeout: 15000 });
    await shot(page, name('checkout-free'));
    const payText = await page.getByText('支付通道暂时不可用').innerText();
    record(`${label} 免费用户购买`, payText.includes('支付') ? 'pass' : 'fail', payText);
  } catch (error) {
    await shot(page, name('checkout-fail')).catch(() => {});
    record(`${label} 免费用户购买`, 'fail', error.message);
  }

  try {
    const user = await db.user.findFirst({ where: { phone } });
    const end = new Date(Date.now() + 200 * 86400000);
    const start = new Date(Date.now() - 165 * 86400000);
    await db.user.update({ where: { id: user.id }, data: { plan: 'FULL', planExpireAt: end } });
    const subscription = await db.subscription.upsert({
      where: { userId: user.id },
      update: { plan: 'FULL', status: 'ACTIVE', endDate: end, scheduledPlan: null },
      create: { userId: user.id, plan: 'FULL', status: 'ACTIVE', endDate: end },
    });
    await db.payment.deleteMany({ where: { userId: user.id } });
    await db.payment.create({
      data: {
        orderNo: `UI${phone}`,
        userId: user.id,
        subscriptionId: subscription.id,
        plan: 'FULL',
        billingPeriod: 'yearly',
        amount: '5800.00',
        currency: 'CNY',
        status: 'completed',
        paymentMethod: 'alipay',
        description: '专家版年付',
        paidAt: start,
        serviceStart: start,
        serviceEnd: end,
      },
    });
    await page.goto(base + '/membership', { waitUntil: 'domcontentloaded' });
    await dismissTip(page);
    await page.getByRole('heading', { name: '会员中心' }).waitFor();
    await shot(page, name('membership-paid'));
    await page.getByRole('button', { name: '测算所选订单退款' }).click();
    await page.getByText(/测算应退/).waitFor({ timeout: 15000 });
    await shot(page, name('refund-quote'));
    const refundText = await page.getByText(/测算应退/).innerText();
    await page.getByRole('button', { name: '到期后改为专业版' }).click();
    await page.getByText('已登记到期后改为').waitFor({ timeout: 15000 });
    await shot(page, name('downgrade'));
    const downText = await page.locator('body').innerText();
    record(`${label} 退款测算与到期降级`, refundText.includes('测算') && downText.includes('专业版') ? 'pass' : 'fail', refundText);
    await page.goto(base + '/checkout?plan=PRO&billing=yearly', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /支付宝支付/ }).click();
    await page.getByText('联系客服').waitFor({ timeout: 15000 });
    await shot(page, name('upgrade-contact'));
    const upgradeText = await page.getByText(/联系客服/).first().innerText();
    record(`${label} 有效期内换档`, upgradeText.includes('联系客服') ? 'pass' : 'fail', upgradeText);
  } catch (error) {
    await shot(page, name('billing-fail')).catch(() => {});
    record(`${label} 退款测算、降级与换档`, 'fail', error.message);
  }

  if (label === 'desktop') {
    try {
      const user = await db.user.findFirst({ where: { phone } });
      await db.project.deleteMany({ where: { userId: user.id } });
      const rows = Array.from({ length: 220 }, (_, index) => ({
        userId: user.id,
        name: `界面测试项目${index + 1}`,
        type: index % 2 === 0 ? 'SOLAR' : 'WIND',
        capacity: 100 + index,
        lng: 116.4,
        lat: 39.9,
      }));
      await db.project.createMany({ data: rows });
      await page.goto(base + '/settings', { waitUntil: 'domcontentloaded' });
      await dismissTip(page);
      await page.getByText('导出我的全部数据').scrollIntoViewIfNeeded();
      await shot(page, name('export-entry'));
      const response = await page.request.post(base + '/api/exports', {
        data: { dataType: 'projects', format: 'json' },
      });
      const payload = await response.json();
      if (!response.ok()) throw new Error(JSON.stringify(payload).slice(0, 200));
      const downloadUrl = String(payload.downloadUrl || '');
      const absolute = downloadUrl.startsWith('http') ? downloadUrl : base + downloadUrl;
      const download = await page.request.get(absolute);
      const bytes = (await download.body()).length;
      await page.evaluate(({ status, bytes: size, url }) => {
        const note = document.createElement('pre');
        note.id = 'export-proof';
        note.textContent = `大批量项目导出 ${status}\n下载 ${url}\n字节 ${size}`;
        note.style.cssText = 'position:fixed;inset:16px auto auto 16px;z-index:9999;background:#fff;color:#111;padding:16px;border:2px solid #059669;max-width:90vw';
        document.body.prepend(note);
      }, { status: response.status(), bytes, url: downloadUrl });
      await shot(page, name('export-large'));
      record(`${label} 大批量导出`, bytes > 1000 ? 'pass' : 'fail', `${response.status()} ${bytes} bytes`);
    } catch (error) {
      await shot(page, name('export-fail')).catch(() => {});
      record(`${label} 大批量导出`, 'fail', error.message);
    }
  }

  try {
    await page.goto(base + '/api/health', { waitUntil: 'domcontentloaded' });
    await shot(page, name('health-web'));
    const webHealth = await page.locator('body').innerText();
    await page.goto('http://127.0.0.1:8000/health', { waitUntil: 'domcontentloaded' });
    await shot(page, name('health-api'));
    const apiHealth = await page.locator('body').innerText();
    record(`${label} 健康检查`, webHealth.includes('"up"') && apiHealth.includes('"ok"') ? 'pass' : 'fail', `web ${webHealth.slice(0, 80)} api ${apiHealth.slice(0, 80)}`);
  } catch (error) {
    await shot(page, name('health-fail')).catch(() => {});
    record(`${label} 健康检查`, 'fail', error.message);
  }

  try {
    await page.goto(base + '/this-page-does-not-exist', { waitUntil: 'domcontentloaded' });
    await shot(page, name('not-found'));
    await page.goto(base + '/auth/error?error=Verification', { waitUntil: 'domcontentloaded' });
    await shot(page, name('auth-error'));
    record(`${label} 错误页`, 'pass');
  } catch (error) {
    record(`${label} 错误页`, 'fail', error.message);
  }

  await context.close();
}

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
try {
  await runViewport(browser, 'desktop', 1440, 900, '13900001001');
  await runViewport(browser, 'mobile', 390, 844, '13900001002');
} finally {
  await browser.close();
  await db.$disconnect();
  fs.writeFileSync(path.join(out, 'report-20261026.json'), JSON.stringify(report, null, 2));
  const failed = report.filter((item) => item.status === 'fail');
  console.log(JSON.stringify({ total: report.length, failed: failed.length }));
  if (failed.length) process.exitCode = 1;
}
