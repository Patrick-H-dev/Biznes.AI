// Dane przykładowe: zatwierdzony plan na poprzedni rok i szkic na kolejny.

import { emptyData } from './defaults';
import { copyPlanToYear, createLine, createPlan } from './planOps';
import type { AppData, BudgetLine, Category } from './types';

export function demoData(now = new Date()): AppData {
  const data = emptyData();
  const year = now.getFullYear();
  const byName = (name: string) => data.categories.find((c) => c.name === name)!;

  const social = byName('Social media');
  const subs: Category[] = ['Meta', 'LinkedIn', 'TikTok'].map((name, i) => ({
    id: `cat-social-${i + 1}`,
    name,
    type: social.type,
    parentId: social.id,
    color: social.color,
    active: true,
  }));
  data.categories.push(...subs);

  const line = (categoryId: string, amount: number, revenue = 0, assumption = '', extra: Partial<BudgetLine> = {}): BudgetLine => ({
    ...createLine(categoryId),
    annualAmount: String(amount),
    revenue: String(revenue),
    assumption,
    ...extra,
  });

  const previous = {
    ...createPlan({
      year,
      name: `Plan marketingu ${year}`,
      currency: 'PLN',
      limit: '950000',
      defaultMarginPct: '35',
      salesTarget: '12000000',
    }),
    status: 'approved' as const,
    approvedAt: new Date(year - 1, 11, 15).toISOString(),
    createdAt: new Date(year - 1, 10, 20).toISOString(),
  };
  previous.lines = [
    line(subs[0].id, 90000, 360000, 'ROAS 4,0 z kampanii Meta w poprzednim roku'),
    line(subs[1].id, 30000, 75000, 'Leady B2B: 120 × konwersja 25% × koszyk 2 500 zł'),
    line(byName('SEM/Google Ads').id, 180000, 810000, 'ROAS 4,5 – średnia z ostatnich 12 mies.', { seasonality: 'q4_peak' }),
    line(byName('Strona www/SEO').id, 80000, 240000, 'Ruch organiczny +15% r/r × konwersja 1,8%'),
    line(byName('E-mail/CRM').id, 40000, 220000, 'Baza 60 tys. adresów, 2 kampanie/mies.'),
    line(byName('Radio').id, 160000, 0, '', { brandKpi: { reach: '2400000', cpm: '35' } }),
    line(byName('Outdoor').id, 120000, 0, '', { seasonality: 'summer' }),
    line(byName('PR').id, 70000),
    line(byName('Eventy').id, 90000, 0, '', { seasonality: 'spring_autumn' }),
    line(byName('Rezerwa').id, 50000),
  ];

  const next = copyPlanToYear(previous, year + 1, '5', `Plan marketingu ${year + 1}`);
  next.limit = '1100000';
  const sem = next.lines.find((l) => l.categoryId === byName('SEM/Google Ads').id)!;
  sem.annualAmount = '210000';
  sem.revenue = '945000';
  next.lines.push(
    line(subs[2].id, 40000, 52000, 'Test kanału – benchmark ROAS 1,3 z branży'),
    line(byName('Influencer').id, 60000, 150000, 'Kody rabatowe: 1 500 zamówień × 100 zł'),
  );

  data.plans = [previous, next];
  return data;
}
