import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
    confirmPickerSelection,
    dismissPickerSelection,
    openPickerSession,
    stagePickerSelection,
} from './picker-selection';

const BEIJING = { lat: 39.9042, lng: 116.4074, address: '', province: '北京' };
const TAPPED = { lat: 37.0845, lng: 109.2004, address: '' };

describe('位置选择器：关闭、取消、确认', () => {
    const picker = readFileSync(join(__dirname, '../../components/map/LocationPicker.tsx'), 'utf8');

    it('✕ 和取消都恢复打开前的位置，未确认的点选不会留下', () => {
        const opened = openPickerSession(BEIJING);
        const staged = stagePickerSelection(opened, TAPPED);
        const closed = dismissPickerSelection(staged);
        expect(closed.restored).toEqual(BEIJING);
        expect(closed.restored).not.toMatchObject({ lat: TAPPED.lat, lng: TAPPED.lng });
        expect(closed.session.pending).toEqual(BEIJING);
        expect(closed.session.committed).toEqual(BEIJING);
    });

    it('还没有打开前的位置时，关闭和取消也不提交这次点选', () => {
        const staged = stagePickerSelection(openPickerSession(null), TAPPED);
        const closed = dismissPickerSelection(staged);
        expect(closed.restored).toBeNull();
        expect(closed.session.pending).toBeNull();
    });

    it('确认选择才提交待确认的点；没有点选时不能确认', () => {
        const opened = openPickerSession(BEIJING);
        expect(confirmPickerSelection(opened, TAPPED)).toBeNull();
        const staged = stagePickerSelection(opened, TAPPED);
        const confirmed = confirmPickerSelection(staged, { ...TAPPED, address: '待确认位置', province: '陕西' });
        expect(confirmed?.applied).toEqual({ ...TAPPED, address: '待确认位置', province: '陕西' });
        expect(confirmed?.applied).not.toEqual(BEIJING);
        expect(confirmed?.session.committed).toEqual(confirmed?.applied);
    });

    it('对话框上 ✕ 走取消，确认选择才调用 onChange', () => {
        expect(picker).toMatch(/const handleDismiss = \(\) => \{\s*handleCancel\(\);\s*\}/);
        expect(picker).toContain('aria-label="关闭"');
        expect(picker).toContain('onClick={handleDismiss}');
        expect(picker).toMatch(/onClick=\{handleCancel\}[^>]*>\s*取消\s*</);
        expect(picker).toContain('onClick={handleConfirm}');
        expect(picker).toContain('确认选择');
        expect(picker).toContain('dismissPickerSelection');
        expect(picker).toContain('confirmPickerSelection');
        const confirmFn = picker.slice(picker.indexOf('const handleConfirm'), picker.indexOf('const handleCancel'));
        expect(confirmFn).toContain('onChange(result.applied)');
        expect(confirmFn).toContain('confirmPickerSelection');
        const cancelFn = picker.slice(picker.indexOf('const handleCancel'), picker.indexOf('const handleDismiss'));
        expect(cancelFn).toContain('dismissPickerSelection');
        expect(picker).toContain("onPick={(location) => stage({ lat: location.lat, lng: location.lng, address: '' })}");
        expect(picker).not.toContain('onPick={(location) => publish(');
    });
});
