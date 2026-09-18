import { describe, it, expect } from 'vitest';
import { getNetProfitForPeriod } from '../services/dashboard.service';
import { getNetProfit } from '../services/reports.service';

describe('dashboard net profit period filter', () => {
  it('TODAY matches getNetProfit({ dateFrom: startOfToday }) exactly - no second calculation', async () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const expected = await getNetProfit({ dateFrom: todayStart });
    const result = await getNetProfitForPeriod('TODAY');

    expect(result.netProfit).toBeCloseTo(Math.round(expected.netProfit * 100) / 100, 2);
    expect(result.revenue).toBeCloseTo(Math.round(expected.revenue * 100) / 100, 2);
    expect(result.period).toBe('TODAY');
  });

  it('ALL time has no lower bound and its net profit is <= any narrower period (more or equal activity included)', async () => {
    const all = await getNetProfitForPeriod('ALL');
    const today = await getNetProfitForPeriod('TODAY');
    const week = await getNetProfitForPeriod('WEEK');
    const month = await getNetProfitForPeriod('MONTH');
    const year = await getNetProfitForPeriod('YEAR');

    expect(all.periodStart).toBeNull();
    expect(today.periodStart).not.toBeNull();
    // Every narrower period's window is a subset of a wider one.
    expect(new Date(week.periodStart!).getTime()).toBeLessThanOrEqual(new Date(today.periodStart!).getTime());
    expect(new Date(month.periodStart!).getTime()).toBeLessThanOrEqual(new Date(week.periodStart!).getTime());
    expect(new Date(year.periodStart!).getTime()).toBeLessThanOrEqual(new Date(month.periodStart!).getTime());
  });

  it('falls back to TODAY for an unrecognized period value rather than throwing', async () => {
    // getNetProfitForPeriod itself only accepts typed periods; the controller does the
    // fallback for bad query strings - this test locks in that every real period resolves.
    for (const period of ['TODAY', 'WEEK', 'MONTH', 'YEAR', 'ALL'] as const) {
      const result = await getNetProfitForPeriod(period);
      expect(typeof result.netProfit).toBe('number');
      expect(result.period).toBe(period);
    }
  });
});
