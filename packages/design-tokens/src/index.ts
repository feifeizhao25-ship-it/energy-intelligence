/**
 * @energy-intelligence/design-tokens — single source of truth for the CSS
 * custom property names used by the component libraries and frontends.
 */

export const colorTokens = {
  brand50: '--color-brand-50',
  brand100: '--color-brand-100',
  brand500: '--color-brand-500',
  brand600: '--color-brand-600',
  success: '--color-success',
  successBg: '--color-success-bg',
  warning: '--color-warning',
  warningBg: '--color-warning-bg',
  danger: '--color-danger',
  dangerBg: '--color-danger-bg',
  info: '--color-info',
  infoBg: '--color-info-bg',
} as const;

export const surfaceTokens = {
  bgPrimary: '--bg-primary',
  bgSecondary: '--bg-secondary',
  bgTertiary: '--bg-tertiary',
  textPrimary: '--text-primary',
  textSecondary: '--text-secondary',
  textTertiary: '--text-tertiary',
  borderDefault: '--border-default',
  borderStrong: '--border-strong',
} as const;

export const radiusTokens = {
  sm: '--radius-sm',
  md: '--radius-md',
  lg: '--radius-lg',
} as const;

export const elevationTokens = {
  sticky: '--z-sticky',
  overlay: '--z-overlay',
  modal: '--z-modal',
} as const;

export const tokens = {
  color: colorTokens,
  surface: surfaceTokens,
  radius: radiusTokens,
  elevation: elevationTokens,
} as const;

export type TokenName =
  | (typeof colorTokens)[keyof typeof colorTokens]
  | (typeof surfaceTokens)[keyof typeof surfaceTokens]
  | (typeof radiusTokens)[keyof typeof radiusTokens]
  | (typeof elevationTokens)[keyof typeof elevationTokens];

/** Wrap a token name for use in inline styles: tokenVar('--color-brand-500'). */
export function tokenVar(name: TokenName): string {
  return `var(${name})`;
}
