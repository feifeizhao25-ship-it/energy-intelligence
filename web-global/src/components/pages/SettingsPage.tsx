'use client';
/**
 * EnergyIQ — Settings Page
 *
 * Language and notification preferences, persisted to localStorage only
 * (no backend call). Everything here reflects real, local behavior — no
 * pretend integrations.
 *
 * All copy in English. Uses CSS Variables for theming.
 */

import React, { useEffect, useState } from 'react';
import { Button, Card, Switch } from '@energy-intelligence/ui-web';
import GlobalShell from '../GlobalShell';

const STORAGE_KEY = 'energyiq.settings.v1';

interface Preferences {
  language: string;
  notifications: {
    emailAlerts: boolean;
    weeklyDigest: boolean;
    reportReady: boolean;
    policyUpdates: boolean;
  };
}

const DEFAULTS: Preferences = {
  language: 'en-US',
  notifications: {
    emailAlerts: true,
    weeklyDigest: true,
    reportReady: true,
    policyUpdates: false,
  },
};

const NOTIFICATION_OPTIONS: Array<{
  key: keyof Preferences['notifications'];
  label: string;
  description: string;
}> = [
  {
    key: 'emailAlerts',
    label: 'Critical alerts by email',
    description: 'Portfolio events and outages that need immediate attention',
  },
  {
    key: 'weeklyDigest',
    label: 'Weekly market digest',
    description: 'PPA price movements and queue milestones, every Monday',
  },
  {
    key: 'reportReady',
    label: 'Report completion notices',
    description: 'Get notified when a generated report is ready to download',
  },
  {
    key: 'policyUpdates',
    label: 'Policy updates',
    description: 'IRA guidance, IRS notices and state docket activity',
  },
];

const SettingsPage: React.FC = () => {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULTS);
  const [role, setRole] = useState('');
  const [focus, setFocus] = useState('');
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // Load persisted preferences after mount (static export: no server state).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Preferences> & { role?: string; focus?: string };
        setPrefs({
          language: parsed.language ?? DEFAULTS.language,
          notifications: { ...DEFAULTS.notifications, ...parsed.notifications },
        });
        setRole(typeof parsed.role === 'string' ? parsed.role : '');
        setFocus(typeof parsed.focus === 'string' ? parsed.focus : '');
      }
    } catch {
      // Corrupted storage — fall back to defaults.
    }
  }, []);

  const save = () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...prefs, role, focus }));
    setSavedAt(new Date().toLocaleTimeString('en-US'));
  };

  const toggle = (key: keyof Preferences['notifications']) => (checked: boolean) =>
    setPrefs((prev) => ({
      ...prev,
      notifications: { ...prev.notifications, [key]: checked },
    }));

  return (
    <GlobalShell title="Settings" breadcrumb={['EnergyIQ', 'Settings']}>
      <div className="max-w-[720px] mx-auto space-y-6">
        <div>
          <h2 className="text-[20px] font-bold text-[var(--text-primary)]">Settings</h2>
          <p className="text-[13px] text-[var(--text-secondary)] mt-1">
            Preferences are stored in this browser only.
          </p>
        </div>

        {/* ── Language ── */}
        <Card title="Language" padding="lg">
          <div className="space-y-3">
            <label
              htmlFor="settings-language"
              className="block text-[12px] font-medium text-[var(--text-secondary)]"
            >
              Interface language
            </label>
            <select
              id="settings-language"
              value={prefs.language}
              onChange={(e) => setPrefs((prev) => ({ ...prev, language: e.target.value }))}
              className="h-9 w-full max-w-[280px] rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 text-[14px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-brand-500)]"
            >
              <option value="en-US">English (US)</option>
            </select>
            <p className="text-[12px] text-[var(--text-tertiary)]">
              The international edition is available in English only. Additional languages are on
              the roadmap.
            </p>
          </div>
        </Card>

        <Card title="Role and focus" padding="lg">
          <div className="space-y-3">
            {!role && !focus ? (
              <p role="status" className="text-[13px] text-[var(--text-secondary)]">
                No role or technology focus has been chosen. None is assumed.
              </p>
            ) : null}
            <label className="block text-[12px] font-medium text-[var(--text-secondary)]" htmlFor="settings-role">
              Role
              <select id="settings-role" value={role} onChange={(event) => setRole(event.target.value)} className="mt-1 h-9 w-full max-w-[280px] rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 text-[14px]">
                <option value="">Choose later</option>
                <option value="investor">Investor</option>
                <option value="operations">Operations</option>
                <option value="developer">Developer</option>
                <option value="analyst">Analyst</option>
              </select>
            </label>
            <label className="block text-[12px] font-medium text-[var(--text-secondary)]" htmlFor="settings-focus">
              Technology focus
              <select id="settings-focus" value={focus} onChange={(event) => setFocus(event.target.value)} className="mt-1 h-9 w-full max-w-[280px] rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 text-[14px]">
                <option value="">Choose later</option>
                <option value="solar_pv">Solar PV</option>
                <option value="wind">Wind</option>
                <option value="storage">Storage</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </label>
          </div>
        </Card>

        {/* ── Notifications ── */}
        <Card title="Notifications" padding="lg">
          <div className="space-y-3">
            {NOTIFICATION_OPTIONS.map((option) => (
              <div
                key={option.key}
                className="flex items-center justify-between gap-4 p-3 rounded-[var(--radius-md)] border border-[var(--border-default)]"
              >
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-[var(--text-primary)]">
                    {option.label}
                  </div>
                  <div className="text-[12px] text-[var(--text-tertiary)]">
                    {option.description}
                  </div>
                </div>
                <Switch
                  checked={prefs.notifications[option.key]}
                  onChange={toggle(option.key)}
                />
              </div>
            ))}
            <p className="text-[12px] text-[var(--text-tertiary)]">
              Delivery channels will activate once the notification service is connected; these
              toggles save your preference locally in the meantime.
            </p>
          </div>
        </Card>

        <div className="flex items-center gap-3">
          <Button variant="primary" size="md" onClick={save}>
            Save preferences
          </Button>
          {savedAt && (
            <span className="text-[12px] text-[var(--color-success)]">Saved at {savedAt}</span>
          )}
        </div>
      </div>
    </GlobalShell>
  );
};

export default SettingsPage;
