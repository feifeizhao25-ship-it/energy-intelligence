export interface PublicAttribution {
  id: string;
  name: string;
  enabled: boolean;
  attribution: string;
  reason: string;
}

export interface PublicAttributionCatalog {
  sources: PublicAttribution[];
}

export function enabledAttributions(payload: PublicAttributionCatalog) {
  return payload.sources.filter((item) => item.enabled && item.attribution.trim());
}

export function disabledReasons(payload: PublicAttributionCatalog) {
  return payload.sources.filter((item) => !item.enabled);
}
