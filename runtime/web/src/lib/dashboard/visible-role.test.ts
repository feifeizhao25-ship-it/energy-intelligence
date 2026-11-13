import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { displayedRole, landingTemplateRole, SELECTABLE_ROLES } from './visible-role';
import { policyLibraryEmptyCopy } from '@/lib/policy/empty-copy';

const ROOT = join(__dirname, '..', '..');

describe('角色下拉绑定已保存的角色', () => {
    it('地址栏优先，否则用已保存角色，没有保存时不默认成工商业业主', () => {
        expect(displayedRole('om', 'ci_owner')).toBe('om');
        expect(displayedRole(null, 'developer')).toBe('developer');
        expect(displayedRole('nope', 'researcher')).toBe('researcher');
        expect(displayedRole(null, null)).toBeNull();
        expect(displayedRole('', 'engineer')).toBe('engineer');
        expect(displayedRole(null, '储能项目经理')).toBe('储能项目经理');
        expect(displayedRole('developer', '储能项目经理')).toBe('developer');
        expect(SELECTABLE_ROLES).toContain('developer');
        expect(SELECTABLE_ROLES).toContain('om');
        expect(SELECTABLE_ROLES).toContain('engineer');
        expect(landingTemplateRole('engineer')).toBe('epc');
        expect(landingTemplateRole('om')).toBe('om');
        expect(landingTemplateRole(null)).toBeNull();
    });

    it('顶栏和首页不再把初始值写成工商业业主', () => {
        const topbar = readFileSync(join(ROOT, 'components/layout/TopBar.tsx'), 'utf8');
        const landing = readFileSync(join(ROOT, 'components/home/RoleLanding.tsx'), 'utf8');
        expect(topbar).toContain('useRolePreference');
        expect(topbar).not.toContain("useState<ProductRole>('ci_owner')");
        expect(landing).toContain('useRolePreference');
        expect(landing).not.toContain("useState<RoleKey>('ci_owner')");
        expect(landing).toContain('data-module={id}');
    });
});

describe('窄屏先看当前关注，政策空态不编造', () => {
    it('手机上关键数排在正文后面，并保持一行三格', () => {
        const css = readFileSync(join(ROOT, 'app/globals.css'), 'utf8');
        expect(css).toContain('.ei-hero {\n    display: contents;');
        expect(css).toContain('grid-template-columns: repeat(3, minmax(0, 1fr));');
        expect(css).toContain('[data-module="focus"]');
        expect(css).not.toMatch(/\.ei-stats\s*\{\s*grid-template-columns:\s*1fr/);
    });

    it('没有政策时给出空态和下一步，不写假政策', () => {
        const empty = policyLibraryEmptyCopy();
        expect(empty.title).toContain('还没有已审核政策');
        expect(empty.detail).toContain('下一步');
        expect(empty.detail).toContain('不会编造');
        const province = policyLibraryEmptyCopy({ province: '江苏' });
        expect(province.title).toContain('江苏');
        expect(policyLibraryEmptyCopy({ filtered: true }).title).toContain('没有符合条件');
        const page = readFileSync(join(ROOT, 'app/(dashboard)/dashboard/page.tsx'), 'utf8');
        const aside = readFileSync(join(ROOT, 'components/home/HomeAside.tsx'), 'utf8');
        expect(page).toContain('policyLibraryEmptyCopy');
        expect(page).not.toContain('DEMO_POLICIES');
        expect(aside).toContain('policyLibraryEmptyCopy');
        expect(aside).not.toContain('今天没有新的已审核政策');
    });
});
