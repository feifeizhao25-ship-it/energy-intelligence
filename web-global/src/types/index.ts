/**
 * Shared domain types for the EnergyIQ global frontend.
 */

export type UserRole = 'developer' | 'analyst' | 'admin' | 'viewer';

export type SubscriptionPlan = 'free' | 'pro' | 'team' | 'enterprise';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  company?: string;
  country?: string;
  timezone: string;
  language: string;
  currency: string;
  plan: SubscriptionPlan;
  avatarUrl?: string;
  createdAt: string;
  gdprConsent: boolean;
  marketingConsent: boolean;
}
