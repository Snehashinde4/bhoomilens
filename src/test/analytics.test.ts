import { describe, expect, it } from 'vitest';
import {
  acquisitionByState,
  buildNationalKpis,
  delayDriverSeries,
  districtHeatMap,
  documentPipelineSeries,
  gaugeMetrics,
  processingFunnel,
  riskDistribution,
} from '@/services/analytics';
import { paginate } from '@/services/api';
import { getDataset } from '@/data/dataset';

const ALL = {};

describe('analytics selectors', () => {
  it('produces the full KPI set', () => {
    const kpis = buildNationalKpis(ALL);
    expect(kpis.length).toBeGreaterThanOrEqual(18);
    kpis.forEach((k) => {
      expect(k.label.length).toBeGreaterThan(0);
      expect(k.tooltip.length).toBeGreaterThan(0);
      expect(k.route.startsWith('/')).toBe(true);
      expect(k.sparkline.length).toBeGreaterThan(0);
    });
  });

  it('narrows results when a state filter is applied', () => {
    const all = buildNationalKpis(ALL).find((k) => k.key === 'activeProjects')!;
    const rajasthan = buildNationalKpis({ state: 'Rajasthan' }).find((k) => k.key === 'activeProjects')!;
    expect(rajasthan.value).toBeLessThan(all.value);
    expect(rajasthan.value).toBeGreaterThan(0);
  });

  it('builds a monotonically non-increasing processing funnel', () => {
    const funnel = processingFunnel(ALL);
    for (let i = 1; i < funnel.length; i += 1) {
      expect(funnel[i].value).toBeLessThanOrEqual(funnel[i - 1].value);
    }
  });

  it('distributes every project across the four risk bands', () => {
    const distribution = riskDistribution(ALL);
    const total = distribution.reduce((s, d) => s + d.value, 0);
    expect(total).toBe(getDataset().projects.length);
  });

  it('returns aligned series for the document pipeline', () => {
    const series = documentPipelineSeries(ALL);
    expect(series.periods.length).toBe(series.uploaded.length);
    expect(series.periods.length).toBe(series.validated.length);
  });

  it('aggregates acquisition by state consistently', () => {
    const series = acquisitionByState(ALL);
    expect(series.states.length).toBe(series.notified.length);
    expect(series.states.length).toBeGreaterThan(0);
  });

  it('attributes every project to a delay driver', () => {
    const drivers = delayDriverSeries(ALL);
    const total = drivers.reduce((s, d) => s + d.count, 0);
    expect(total).toBe(getDataset().projects.length);
  });

  it('produces heat-map points inside the axis ranges', () => {
    const heat = districtHeatMap(ALL, 'digitizationProgress');
    heat.points.forEach(([x, y]) => {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(heat.districts.length);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThan(heat.states.length);
    });
  });

  it('keeps gauge values within 0-100', () => {
    const gauges = gaugeMetrics(ALL);
    Object.values(gauges).forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    });
  });
});

describe('paginate', () => {
  const rows = Array.from({ length: 57 }, (_, i) => ({ id: `r${i}`, name: `Row ${i}`, value: i }));

  it('slices pages correctly', () => {
    const page = paginate(rows, { page: 2, pageSize: 10 });
    expect(page.rows).toHaveLength(10);
    expect(page.total).toBe(57);
    expect(page.rows[0].id).toBe('r10');
  });

  it('filters by search across the requested keys', () => {
    const page = paginate(rows, { search: 'Row 4', pageSize: 100 }, ['name']);
    expect(page.total).toBeGreaterThan(0);
    page.rows.forEach((r) => expect(String(r.name)).toContain('Row 4'));
  });

  it('sorts numerically in both directions', () => {
    const desc = paginate(rows, { sortBy: 'value', sortDir: 'desc', pageSize: 5 });
    expect(desc.rows[0].value).toBe(56);
    const asc = paginate(rows, { sortBy: 'value', sortDir: 'asc', pageSize: 5 });
    expect(asc.rows[0].value).toBe(0);
  });
});
