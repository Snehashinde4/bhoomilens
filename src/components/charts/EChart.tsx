import { useEffect, useImperativeHandle, useRef, forwardRef } from 'react';
import * as echarts from 'echarts';
import type { EChartsOption } from 'echarts';
import { THEME } from '@/config/constants';

export interface EChartHandle {
  getPngDataUrl: () => string | null;
  instance: () => echarts.ECharts | null;
}

interface EChartProps {
  option: EChartsOption;
  height?: number | string;
  onEvent?: Record<string, (params: unknown) => void>;
  className?: string;
  ariaLabel: string;
}

/** Shared axis/label styling so every chart in the product reads consistently. */
export const BASE_OPTION: EChartsOption = {
  textStyle: { fontFamily: '"IBM Plex Sans", system-ui, sans-serif', color: THEME.ink },
  grid: { left: 48, right: 20, top: 34, bottom: 34, containLabel: true },
  tooltip: {
    trigger: 'axis',
    backgroundColor: '#fffdf8',
    borderColor: THEME.line,
    borderWidth: 1,
    textStyle: { color: THEME.ink, fontSize: 12 },
    extraCssText: 'box-shadow:0 8px 24px rgba(7,26,43,0.16); border-radius:6px;',
  },
  legend: {
    type: 'scroll',
    top: 0,
    icon: 'roundRect',
    itemWidth: 10,
    itemHeight: 10,
    textStyle: { fontSize: 11, color: THEME.muted },
  },
};

export const AXIS_STYLE = {
  axisLine: { lineStyle: { color: THEME.line } },
  axisTick: { show: false },
  axisLabel: { color: THEME.muted, fontSize: 11 },
  splitLine: { lineStyle: { color: 'rgba(201,189,169,0.35)', type: 'dashed' as const } },
};

export const EChart = forwardRef<EChartHandle, EChartProps>(function EChart(
  { option, height = 300, onEvent, className, ariaLabel },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useImperativeHandle(ref, () => ({
    getPngDataUrl: () =>
      chartRef.current?.getDataURL({ pixelRatio: 2, backgroundColor: THEME.surface }) ?? null,
    instance: () => chartRef.current,
  }));

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = echarts.init(containerRef.current, undefined, { renderer: 'canvas' });
    chartRef.current = chart;

    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.setOption({ ...BASE_OPTION, ...option } as EChartsOption, { notMerge: true });
  }, [option]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !onEvent) return;
    Object.entries(onEvent).forEach(([event, handler]) => {
      chart.off(event);
      chart.on(event, handler as (params: unknown) => void);
    });
    return () => {
      Object.keys(onEvent).forEach((event) => chart.off(event));
    };
  }, [onEvent]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ height, width: '100%' }}
      role="img"
      aria-label={ariaLabel}
    />
  );
});
