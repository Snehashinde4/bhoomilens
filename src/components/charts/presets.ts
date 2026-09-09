import type { EChartsOption } from 'echarts';
import { CHART_PALETTE, RISK_COLORS, THEME } from '@/config/constants';
import { formatMonth } from '@/lib/format';
import { AXIS_STYLE } from './EChart';
import type { RiskLevel } from '@/types';

/* --------------------------------- 1. Line -------------------------------- */

export function multiLineOption(
  categories: string[],
  series: Array<{ name: string; data: number[]; color?: string; area?: boolean }>,
  opts: { asMonths?: boolean; yName?: string } = {},
): EChartsOption {
  return {
    color: CHART_PALETTE,
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross', label: { backgroundColor: THEME.ink } } },
    legend: { top: 0, textStyle: { fontSize: 11, color: THEME.muted } },
    grid: { left: 8, right: 16, top: 34, bottom: 8, containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: opts.asMonths ? categories.map(formatMonth) : categories,
      ...AXIS_STYLE,
    },
    yAxis: { type: 'value', name: opts.yName, nameTextStyle: { color: THEME.muted, fontSize: 10 }, ...AXIS_STYLE },
    series: series.map((s, i) => ({
      name: s.name,
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 5,
      showSymbol: categories.length <= 26,
      lineStyle: { width: 2 },
      itemStyle: { color: s.color ?? CHART_PALETTE[i % CHART_PALETTE.length] },
      areaStyle: s.area ? { opacity: 0.14 } : undefined,
      data: s.data,
    })),
  };
}

/* ------------------------------ 2. Stacked bar ---------------------------- */

export function stackedBarOption(
  categories: string[],
  series: Array<{ name: string; data: number[] }>,
  opts: { horizontal?: boolean; yName?: string } = {},
): EChartsOption {
  const value = { type: 'value' as const, name: opts.yName, nameTextStyle: { color: THEME.muted, fontSize: 10 }, ...AXIS_STYLE };
  const category = { type: 'category' as const, data: categories, ...AXIS_STYLE, axisLabel: { ...AXIS_STYLE.axisLabel, rotate: opts.horizontal ? 0 : 42 } };
  return {
    color: CHART_PALETTE,
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { top: 0, textStyle: { fontSize: 11, color: THEME.muted } },
    grid: { left: 8, right: 16, top: 34, bottom: 8, containLabel: true },
    xAxis: opts.horizontal ? value : category,
    yAxis: opts.horizontal ? category : value,
    series: series.map((s) => ({
      name: s.name,
      type: 'bar',
      stack: 'total',
      barMaxWidth: 26,
      emphasis: { focus: 'series' },
      data: s.data,
    })),
  };
}

/* ---------------------------- 3. Horizontal bar --------------------------- */

export function horizontalBarOption(
  categories: string[],
  values: number[],
  opts: { color?: string; valueName?: string; colors?: string[] } = {},
): EChartsOption {
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { show: false },
    grid: { left: 8, right: 46, top: 12, bottom: 8, containLabel: true },
    xAxis: { type: 'value', name: opts.valueName, nameTextStyle: { color: THEME.muted, fontSize: 10 }, ...AXIS_STYLE },
    yAxis: { type: 'category', data: categories, ...AXIS_STYLE },
    series: [
      {
        type: 'bar',
        barMaxWidth: 18,
        label: { show: true, position: 'right', fontSize: 11, color: THEME.muted },
        itemStyle: {
          borderRadius: [0, 3, 3, 0],
          color: opts.colors
            ? (p: { dataIndex: number }) => opts.colors![p.dataIndex % opts.colors!.length]
            : opts.color ?? THEME.teal,
        },
        data: values,
      },
    ],
  };
}

/* --------------------------------- 4. Donut ------------------------------- */

export function donutOption(
  data: Array<{ name: string; value: number }>,
  opts: { colors?: string[]; centerLabel?: string; centerValue?: string } = {},
): EChartsOption {
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, textStyle: { fontSize: 11, color: THEME.muted } },
    grid: undefined,
    series: [
      {
        type: 'pie',
        radius: ['54%', '76%'],
        center: ['50%', '46%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: THEME.surface, borderWidth: 2 },
        label: {
          show: true,
          position: 'center',
          formatter: () => `${opts.centerValue ?? ''}\n${opts.centerLabel ?? ''}`,
          fontSize: 13,
          lineHeight: 18,
          color: THEME.ink,
          fontFamily: '"IBM Plex Mono", monospace',
        },
        emphasis: { label: { show: true, fontSize: 15, fontWeight: 'bold' } },
        data: data.map((d, i) => ({
          ...d,
          itemStyle: { color: opts.colors?.[i] ?? CHART_PALETTE[i % CHART_PALETTE.length] },
        })),
      },
    ],
  };
}

export function riskDonutOption(data: Array<{ name: string; value: number }>): EChartsOption {
  const total = data.reduce((s, d) => s + d.value, 0);
  return donutOption(
    data.map((d) => ({ ...d, name: d.name.charAt(0).toUpperCase() + d.name.slice(1) })),
    {
      colors: data.map((d) => RISK_COLORS[d.name as RiskLevel] ?? THEME.teal),
      centerValue: String(total),
      centerLabel: 'projects',
    },
  );
}

/* --------------------------------- 5. Funnel ------------------------------ */

export function funnelOption(data: Array<{ name: string; value: number }>): EChartsOption {
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c}' },
    legend: { show: false },
    grid: undefined,
    series: [
      {
        type: 'funnel',
        left: '6%',
        right: '6%',
        top: 10,
        bottom: 10,
        minSize: '22%',
        sort: 'descending',
        gap: 2,
        label: { show: true, position: 'inside', fontSize: 11, color: '#fff' },
        labelLine: { show: false },
        itemStyle: { borderColor: THEME.surface, borderWidth: 1 },
        data: data.map((d, i) => ({
          ...d,
          itemStyle: { color: CHART_PALETTE[i % CHART_PALETTE.length] },
        })),
      },
    ],
  };
}

/* -------------------------------- 6. Heat map ----------------------------- */

export function heatMapOption(
  xLabels: string[],
  yLabels: string[],
  points: Array<[number, number, number]>,
  opts: { min?: number; max?: number; unit?: string } = {},
): EChartsOption {
  return {
    tooltip: {
      position: 'top',
      formatter: (p: unknown) => {
        const params = p as { value: [number, number, number] };
        return `${xLabels[params.value[0]]} · ${yLabels[params.value[1]]}<br/><b>${params.value[2]}${opts.unit ?? ''}</b>`;
      },
    },
    legend: { show: false },
    grid: { left: 8, right: 16, top: 8, bottom: 58, containLabel: true },
    xAxis: {
      type: 'category',
      data: xLabels,
      splitArea: { show: true },
      axisLabel: { ...AXIS_STYLE.axisLabel, rotate: 52, interval: 0 },
      axisLine: AXIS_STYLE.axisLine,
      axisTick: AXIS_STYLE.axisTick,
    },
    yAxis: {
      type: 'category',
      data: yLabels,
      splitArea: { show: true },
      axisLabel: AXIS_STYLE.axisLabel,
      axisLine: AXIS_STYLE.axisLine,
      axisTick: AXIS_STYLE.axisTick,
    },
    visualMap: {
      min: opts.min ?? 0,
      max: opts.max ?? 100,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      itemHeight: 90,
      textStyle: { fontSize: 10, color: THEME.muted },
      inRange: { color: ['#f2ece1', '#cfe0d8', '#7fbba6', THEME.teal, THEME.ink] },
    },
    series: [
      {
        type: 'heatmap',
        data: points,
        emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(7,26,43,0.4)' } },
        progressive: 2000,
      },
    ],
  };
}

/* --------------------------------- 7. Area -------------------------------- */

export function areaCompareOption(
  categories: string[],
  a: { name: string; data: number[] },
  b: { name: string; data: number[] },
  yName?: string,
): EChartsOption {
  return {
    tooltip: { trigger: 'axis' },
    legend: { top: 0, textStyle: { fontSize: 11, color: THEME.muted } },
    grid: { left: 8, right: 16, top: 34, bottom: 8, containLabel: true },
    xAxis: { type: 'category', boundaryGap: false, data: categories.map(formatMonth), ...AXIS_STYLE },
    yAxis: { type: 'value', name: yName, nameTextStyle: { color: THEME.muted, fontSize: 10 }, ...AXIS_STYLE },
    series: [
      {
        name: a.name,
        type: 'line',
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2, color: THEME.blue },
        areaStyle: { color: 'rgba(57,120,168,0.22)' },
        data: a.data,
      },
      {
        name: b.name,
        type: 'line',
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2, color: THEME.green },
        areaStyle: { color: 'rgba(50,134,107,0.28)' },
        data: b.data,
      },
    ],
  };
}

/* -------------------------------- 8. Scatter ------------------------------ */

export function bubbleScatterOption(
  points: Array<{ value: [number, number, number]; name: string; risk: RiskLevel }>,
): EChartsOption {
  const maxSize = Math.max(...points.map((p) => p.value[2]), 1);
  return {
    tooltip: {
      trigger: 'item',
      formatter: (p: unknown) => {
        const params = p as { data: { name: string; value: [number, number, number] } };
        return `<b>${params.data.name}</b><br/>Completion: ${params.data.value[0]}%<br/>Delay probability: ${params.data.value[1]}%<br/>Affected families: ${params.data.value[2].toLocaleString('en-IN')}`;
      },
    },
    legend: { show: false },
    grid: { left: 8, right: 20, top: 16, bottom: 8, containLabel: true },
    xAxis: { type: 'value', name: 'Completion %', max: 100, nameTextStyle: { color: THEME.muted, fontSize: 10 }, ...AXIS_STYLE },
    yAxis: { type: 'value', name: 'Delay probability %', max: 100, nameTextStyle: { color: THEME.muted, fontSize: 10 }, ...AXIS_STYLE },
    series: [
      {
        type: 'scatter',
        symbolSize: (val: number[]) => 6 + (val[2] / maxSize) * 26,
        data: points.map((p) => ({
          name: p.name,
          value: p.value,
          itemStyle: { color: RISK_COLORS[p.risk], opacity: 0.72 },
        })),
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: THEME.line, type: 'dashed' },
          data: [{ yAxis: 65 }],
          label: { formatter: 'High-risk threshold', fontSize: 10, color: THEME.muted },
        },
      },
    ],
  };
}

/* --------------------------------- 9. Gauge ------------------------------- */

export function gaugeOption(value: number, label: string, color: string = THEME.teal): EChartsOption {
  return {
    tooltip: { show: false },
    legend: { show: false },
    grid: undefined,
    series: [
      {
        type: 'gauge',
        startAngle: 210,
        endAngle: -30,
        min: 0,
        max: 100,
        radius: '96%',
        center: ['50%', '58%'],
        progress: { show: true, width: 10, itemStyle: { color } },
        axisLine: { lineStyle: { width: 10, color: [[1, 'rgba(201,189,169,0.45)']] } },
        pointer: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        anchor: { show: false },
        title: { show: true, offsetCenter: [0, '32%'], fontSize: 11, color: THEME.muted },
        detail: {
          valueAnimation: true,
          offsetCenter: [0, '-2%'],
          fontSize: 22,
          fontFamily: '"IBM Plex Mono", monospace',
          color: THEME.ink,
          formatter: '{value}%',
        },
        data: [{ value: Number(value.toFixed(1)), name: label }],
      },
    ],
  };
}

/* ------------------------------ 10. Waterfall ----------------------------- */

export function waterfallOption(
  items: Array<{ name: string; contribution: number }>,
  baseline = 0,
): EChartsOption {
  const placeholders: number[] = [];
  const values: number[] = [];
  let cursor = baseline;
  items.forEach((item) => {
    placeholders.push(cursor);
    values.push(item.contribution);
    cursor += item.contribution;
  });

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (p: unknown) => {
        const arr = p as Array<{ name: string; dataIndex: number }>;
        const idx = arr[0].dataIndex;
        return `${items[idx].name}<br/>Contribution: <b>+${items[idx].contribution.toFixed(1)}</b> points`;
      },
    },
    legend: { show: false },
    grid: { left: 8, right: 16, top: 12, bottom: 8, containLabel: true },
    xAxis: {
      type: 'category',
      data: items.map((i) => i.name),
      axisLabel: { ...AXIS_STYLE.axisLabel, rotate: 32, interval: 0, width: 90, overflow: 'truncate' },
      axisLine: AXIS_STYLE.axisLine,
      axisTick: AXIS_STYLE.axisTick,
    },
    yAxis: { type: 'value', name: 'risk points', nameTextStyle: { color: THEME.muted, fontSize: 10 }, ...AXIS_STYLE },
    series: [
      {
        type: 'bar',
        stack: 'wf',
        silent: true,
        itemStyle: { color: 'transparent' },
        emphasis: { itemStyle: { color: 'transparent' } },
        data: placeholders,
      },
      {
        type: 'bar',
        stack: 'wf',
        barMaxWidth: 30,
        label: {
          show: true,
          position: 'top',
          fontSize: 10,
          color: THEME.muted,
          formatter: (p: { value?: unknown }) => Number(p.value ?? 0).toFixed(1),
        },
        itemStyle: {
          color: (p: { dataIndex: number }) => CHART_PALETTE[p.dataIndex % CHART_PALETTE.length],
          borderRadius: [3, 3, 0, 0],
        },
        data: values,
      },
    ] as EChartsOption['series'],
  };
}

/* -------------------------------- 11. Gantt ------------------------------- */

export interface GanttRow {
  name: string;
  plannedStart: number;
  plannedEnd: number;
  actualStart: number | null;
  actualEnd: number | null;
  delayed: boolean;
  critical: boolean;
}

export function ganttOption(rows: GanttRow[], todayTs: number, predictedTs?: number): EChartsOption {
  const categories = rows.map((r) => r.name);
  return {
    tooltip: {
      trigger: 'item',
      formatter: (p: unknown) => {
        const params = p as { name: string; value: [number, number, number] };
        const start = new Date(params.value[1]).toLocaleDateString('en-IN');
        const end = new Date(params.value[2]).toLocaleDateString('en-IN');
        return `<b>${categories[params.value[0]]}</b><br/>${start} → ${end}`;
      },
    },
    legend: { show: false },
    grid: { left: 8, right: 24, top: 12, bottom: 24, containLabel: true },
    xAxis: {
      type: 'time',
      axisLabel: { ...AXIS_STYLE.axisLabel, hideOverlap: true },
      axisLine: AXIS_STYLE.axisLine,
      splitLine: AXIS_STYLE.splitLine,
    },
    yAxis: {
      type: 'category',
      data: categories,
      inverse: true,
      axisLabel: AXIS_STYLE.axisLabel,
      axisLine: AXIS_STYLE.axisLine,
      axisTick: AXIS_STYLE.axisTick,
    },
    series: [
      {
        type: 'custom',
        renderItem: (params: unknown, api: unknown) => renderGanttBar(params, api),
        encode: { x: [1, 2], y: 0 },
        data: rows.flatMap((r, i) => {
          const planned = [i, r.plannedStart, r.plannedEnd, 0, r.delayed ? 1 : 0, r.critical ? 1 : 0];
          const actual =
            r.actualStart !== null
              ? [i, r.actualStart, r.actualEnd ?? todayTs, 1, r.delayed ? 1 : 0, r.critical ? 1 : 0]
              : null;
          return actual ? [planned, actual] : [planned];
        }),
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: THEME.red, width: 1.5 },
          label: { formatter: 'Today', fontSize: 10, color: THEME.red },
          data: [{ xAxis: todayTs }, ...(predictedTs ? [{ xAxis: predictedTs }] : [])],
        },
      },
    ] as EChartsOption['series'],
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function renderGanttBar(params: any, api: any) {
  const categoryIndex = api.value(0);
  const start = api.coord([api.value(1), categoryIndex]);
  const end = api.coord([api.value(2), categoryIndex]);
  const isActual = api.value(3) === 1;
  const delayed = api.value(4) === 1;
  const critical = api.value(5) === 1;
  const height = 9;
  const offset = isActual ? 5 : -6;

  const rect = {
    x: start[0],
    y: start[1] + offset - height / 2,
    width: Math.max(end[0] - start[0], 2),
    height,
  };
  const clipped = echartsClip(rect, params.coordSys);
  if (!clipped) return undefined;

  return {
    type: 'rect',
    transition: ['shape'],
    shape: clipped,
    style: {
      fill: isActual ? (delayed ? THEME.red : THEME.teal) : 'rgba(102,120,138,0.32)',
      stroke: critical ? THEME.ink : 'transparent',
      lineWidth: critical ? 1 : 0,
    },
  };
}

function echartsClip(
  rect: { x: number; y: number; width: number; height: number },
  coordSys: { x: number; y: number; width: number; height: number },
) {
  const x = Math.max(rect.x, coordSys.x);
  const x2 = Math.min(rect.x + rect.width, coordSys.x + coordSys.width);
  if (x2 <= x) return null;
  return { x, y: rect.y, width: x2 - x, height: rect.height };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/* -------------------------------- 12. Graph ------------------------------- */

export function graphOption(
  nodes: Array<{ id: string; name: string; symbolSize: number; color: string; category: number; conflict: boolean }>,
  links: Array<{ source: string; target: string; label: string; conflict: boolean }>,
  categories: string[],
): EChartsOption {
  return {
    tooltip: { trigger: 'item', formatter: '{b}' },
    legend: [
      {
        data: categories,
        bottom: 0,
        textStyle: { fontSize: 10, color: THEME.muted },
        itemWidth: 9,
        itemHeight: 9,
      },
    ],
    grid: undefined,
    series: [
      {
        type: 'graph',
        layout: 'force',
        roam: true,
        draggable: true,
        zoom: 1.1,
        categories: categories.map((name) => ({ name })),
        force: { repulsion: 320, edgeLength: 120, gravity: 0.08 },
        label: { show: true, position: 'right', fontSize: 10, color: THEME.ink, formatter: '{b}' },
        edgeLabel: { show: true, fontSize: 9, color: THEME.muted, formatter: (p: unknown) => String((p as { data: { value: string } }).data.value) },
        edgeSymbol: ['none', 'arrow'],
        edgeSymbolSize: 6,
        emphasis: { focus: 'adjacency', lineStyle: { width: 3 } },
        data: nodes.map((n) => ({
          id: n.id,
          name: n.name,
          symbolSize: n.symbolSize,
          category: n.category,
          itemStyle: {
            color: n.color,
            borderColor: n.conflict ? THEME.red : 'transparent',
            borderWidth: n.conflict ? 2.5 : 0,
          },
        })),
        links: links.map((l) => ({
          source: l.source,
          target: l.target,
          value: l.label,
          lineStyle: {
            color: l.conflict ? THEME.red : 'rgba(102,120,138,0.5)',
            width: l.conflict ? 2 : 1,
            curveness: 0.12,
          },
        })),
      },
    ] as EChartsOption['series'],
  };
}

/* ------------------------------ 13. Sparkline ----------------------------- */

export function sparklineOption(values: number[], positive: boolean): EChartsOption {
  return {
    tooltip: { show: false },
    legend: { show: false },
    grid: { left: 0, right: 0, top: 2, bottom: 2 },
    xAxis: { type: 'category', show: false, data: values.map((_, i) => i) },
    yAxis: { type: 'value', show: true, axisLine: { show: false }, axisLabel: { show: false }, splitLine: { show: false }, min: 'dataMin', max: 'dataMax' },
    series: [
      {
        type: 'line',
        data: values,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 1.6, color: positive ? THEME.green : THEME.red },
        areaStyle: { color: positive ? 'rgba(50,134,107,0.16)' : 'rgba(217,93,57,0.16)' },
      },
    ],
  };
}

/* --------------------------- 14. Ranking (bar) ---------------------------- */

export function rankingOption(
  labels: string[],
  values: number[],
  valueName: string,
): EChartsOption {
  return horizontalBarOption(labels, values, {
    valueName,
    colors: values.map((_, i) => CHART_PALETTE[i % CHART_PALETTE.length]),
  });
}

/* ------------------------- 15. Grouped comparison ------------------------- */

export function groupedBarOption(
  categories: string[],
  series: Array<{ name: string; data: number[]; color?: string }>,
  yName?: string,
): EChartsOption {
  return {
    color: CHART_PALETTE,
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { top: 0, textStyle: { fontSize: 11, color: THEME.muted } },
    grid: { left: 8, right: 16, top: 34, bottom: 8, containLabel: true },
    xAxis: { type: 'category', data: categories, ...AXIS_STYLE, axisLabel: { ...AXIS_STYLE.axisLabel, rotate: categories.length > 8 ? 34 : 0 } },
    yAxis: { type: 'value', name: yName, nameTextStyle: { color: THEME.muted, fontSize: 10 }, ...AXIS_STYLE },
    series: series.map((s) => ({
      name: s.name,
      type: 'bar',
      barMaxWidth: 18,
      itemStyle: { color: s.color, borderRadius: [3, 3, 0, 0] },
      data: s.data,
    })),
  };
}
