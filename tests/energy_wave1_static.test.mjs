import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(path, 'utf8');

test('web-global header search icon is a 16px header mark', () => {
  const shell = read('packages/ui-web/src/AppShell.tsx');
  const css = read('web-global/src/app/globals.css');
  assert.match(shell, /data-header-search/);
  assert.match(shell, /width=\{16\}/);
  assert.match(shell, /height=\{16\}/);
  assert.match(css, /header \[data-header-search\] svg/);
  assert.match(css, /width:\s*16px/);
  assert.match(css, /height:\s*16px/);
});

test('US rules card lists the §48E conflict and does not pick a winner', () => {
  const conflict = JSON.parse(read('web-global/src/lib/policy/us-48e-45y-conflict.json'));
  const page = read('web-global/src/pages/IncentivesPage.tsx');
  assert.equal(conflict.resolution, null);
  assert.deepEqual(conflict.conflict_ids, ['EI-06', 'EI-08', 'EI-09']);
  const byId = Object.fromEntries(conflict.sources.map((row) => [row.id, row]));
  assert.match(byId['EI-06'].statement, /2032/);
  assert.equal(byId['EI-06'].dated, null);
  assert.match(byId['EI-07'].url, /clean-electricity-production-credit/);
  assert.match(byId['EI-08'].statement, /2027-12-31/);
  assert.match(byId['EI-08'].statement, /2026-07-04/);
  assert.equal(byId['EI-08'].dated, '2025-08');
  assert.match(byId['EI-09'].statement, /2026-06-06/);
  assert.match(byId['EI-09'].date_label, /2026-06-16/);
  assert.match(page, /us-rules-conflict/);
  assert.match(page, /No source is selected/);
  assert.doesNotMatch(page, /Through 2032/);
});

test('screening sources stay side by side', () => {
  const sources = JSON.parse(read('runtime/web-int/src/lib/screening-sources.json'));
  const page = read('runtime/web-int/src/app/assessment/page.tsx');
  assert.deepEqual(sources.map((row) => row.name), ['PVGIS', 'NSRDB', 'NASA POWER']);
  assert.equal(new Set(sources.map((row) => row.url)).size, 3);
  for (const row of sources) assert.match(row.note, /Not |not /);
  assert.match(page, /does not average the three/);
  assert.match(page, /other listed sources are not included/);
  assert.match(sources.find((row) => row.id === 'nsrdb').url, /nsrdb\.nlr\.gov/);
  assert.doesNotMatch(JSON.stringify(sources), /nrel\.gov/);
});

test('domestic library records the 2023 factor, 136, and NEA 7', () => {
  const library = JSON.parse(read('android-cn/assets/library/energy_library_v1.json'));
  const bundled = JSON.parse(read('runtime/backend/app/library/data/entries_cn_v1.json'));
  const ios = JSON.parse(read('ios-cn/assets/library/energy_library_v1.json'));
  assert.deepEqual(library, bundled);
  assert.deepEqual(library, ios);
  const byId = Object.fromEntries(library.entries.map((row) => [row.id, row]));
  assert.equal(byId['en-lib-020'].review_status, '待审核');
  assert.match(byId['en-lib-020'].summary, /不是 2025 年数据/);
  assert.match(byId['en-lib-020'].summary, /2023/);
  assert.equal(byId['en-lib-020'].source.doc_no, '公告〔2025〕47号');
  assert.equal(byId['en-lib-020'].publish_date, '2025-12-31');
  assert.equal(byId['en-lib-021'].source.doc_no, '发改价格〔2025〕136号');
  assert.equal(byId['en-lib-022'].source.doc_no, '国能发新能规〔2025〕7号');
  assert.match(byId['en-lib-022'].source.url, /content_7004206\.htm/);
  for (const row of [byId['en-lib-020'], byId['en-lib-021'], byId['en-lib-022']]) {
    assert.equal(row.reviewer, undefined);
    assert.equal(row.review_status, '待审核');
  }
  const demo = read('runtime/web/src/lib/policy/demo-library.ts');
  assert.match(demo, /国能发新能规〔2025〕7号/);
  assert.match(demo, /发改价格〔2025〕136号/);
});

test('international library shows the credit conflict without a reviewer name', () => {
  const library = JSON.parse(read('android-global/assets/library/energy_library_intl_v1.json'));
  const bundled = JSON.parse(read('runtime/backend/app/library/data/entries_global_v1.json'));
  assert.deepEqual(library, bundled);
  const entry = library.entries.find((row) => row.id === 'en-intl-009');
  assert.equal(entry.review_status, 'Pending review');
  assert.equal(entry.status, 'Unverified');
  assert.match(entry.points[0], /2032/);
  assert.match(entry.points[1], /Notice 2025-42/);
  assert.match(entry.points[2], /2026-06-06/);
  assert.equal(entry.reviewer, undefined);
});

test('ATB and NSRDB oracle links use the nlr.gov pages the registry already named', () => {
  const oracles = read('后端/add_f16_oracles.py');
  assert.match(oracles, /https:\/\/nsrdb\.nlr\.gov\//);
  assert.match(oracles, /https:\/\/atb\.nlr\.gov\//);
  assert.doesNotMatch(oracles, /nsrdb\.nrel\.gov/);
  assert.doesNotMatch(oracles, /atb\.nrel\.gov/);
});

test('speech fallback is present on every sibling web app', () => {
  for (const file of [
    'web-global/src/lib/voice/localFirstSpeech.ts',
    'web-frontend/src/lib/voice/localFirstSpeech.ts',
    'runtime/web/src/lib/voice/localFirstSpeech.ts',
    'frontend-cn-web/src/lib/voice/localFirstSpeech.ts',
  ]) {
    const source = read(file);
    assert.match(source, /language-not-supported/);
    assert.match(source, /network/);
    assert.match(source, /ON_DEVICE_FALLBACK_ERRORS/);
  }
});

test('shells keep a calm error card around child content', () => {
  assert.match(read('web-global/src/components/GlobalShell.tsx'), /ShellErrorBoundary/);
  assert.match(read('runtime/web/src/components/layout/AppChrome.tsx'), /ShellErrorBoundary/);
  assert.match(read('web-frontend/src/app/%28dashboard%29/layout.tsx'), /ShellErrorBoundary/);
  assert.match(read('frontend-cn-web/src/pages/_app.tsx'), /ShellErrorBoundary/);
  for (const app of ['ios-cn', 'ios-global', 'android-cn', 'android-global']) {
    assert.match(read(`${app}/lib/main.dart`), /installCalmErrorWidget/);
    assert.match(read(`${app}/lib/widgets/calm_error_card.dart`), /ErrorWidget\.builder/);
  }
});
