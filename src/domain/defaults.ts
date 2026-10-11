import type { AppData, Category, CategoryType, Settings } from './types';

// Kolory kategorii – kolejność slotów palety kategorycznej (stała, nie cyklowana).
export const CATEGORY_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];

const STARTER: [string, CategoryType][] = [
  ['Social media', 'performance'],
  ['Strona www/SEO', 'performance'],
  ['SEM/Google Ads', 'performance'],
  ['Radio', 'brand'],
  ['TV', 'brand'],
  ['Outdoor', 'brand'],
  ['PR', 'brand'],
  ['Eventy', 'brand'],
  ['Content', 'performance'],
  ['E-mail/CRM', 'performance'],
  ['Influencer', 'performance'],
  ['Rezerwa', 'brand'],
];

export function starterCategories(): Category[] {
  return STARTER.map(([name, type], i) => ({
    id: `cat-${i + 1}`,
    name,
    type,
    parentId: null,
    color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
    active: true,
  }));
}

export function defaultSettings(): Settings {
  return {
    defaultCurrency: 'PLN',
    defaultMarginPct: '35',
    thresholds: { romiMinPct: '0', roasMax: '20', concentrationMaxPct: '40' },
  };
}

export function emptyData(): AppData {
  return {
    schemaVersion: 1,
    settings: defaultSettings(),
    categories: starterCategories(),
    plans: [],
    audit: [],
  };
}
