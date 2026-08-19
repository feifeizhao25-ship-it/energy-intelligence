/**
 * @energy-intelligence/i18n — minimal dictionary-based translation helper.
 * Framework bindings (react-i18next / next-intl) consume these dictionaries.
 */

export type Locale = 'zh-CN' | 'en';

export type Dictionary = Record<string, string>;

export interface I18nOptions {
  locale: Locale;
  fallbackLocale?: Locale;
  dictionaries: Partial<Record<Locale, Dictionary>>;
}

export interface I18n {
  locale: Locale;
  t(key: string, params?: Record<string, string | number>): string;
}

export function createI18n(options: I18nOptions): I18n {
  const fallbackLocale = options.fallbackLocale ?? 'en';
  const translate = (
    locale: Locale,
    key: string,
    params?: Record<string, string | number>,
  ): string | undefined => {
    const template = options.dictionaries[locale]?.[key];
    if (template === undefined) {
      return undefined;
    }
    if (!params) {
      return template;
    }
    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in params ? String(params[name]) : match,
    );
  };
  return {
    locale: options.locale,
    t(key, params) {
      return (
        translate(options.locale, key, params) ??
        translate(fallbackLocale, key, params) ??
        key
      );
    },
  };
}
