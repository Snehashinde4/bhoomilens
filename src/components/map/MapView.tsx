import { useEffect, useImperativeHandle, useRef, forwardRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { appConfig } from '@/config/appConfig';
import { THEME } from '@/config/constants';
import type { FeatureCollection } from '@/lib/geo';

export interface MapLayerSpec {
  id: string;
  label: string;
  group: 'administrative' | 'cadastral' | 'project' | 'environment' | 'evidence';
  visible: boolean;
  data: FeatureCollection;
  style: {
    color: string;
    weight: number;
    fillColor?: string;
    fillOpacity?: number;
    dashArray?: string;
  };
  kind: 'polygon' | 'point';
  popup?: (props: Record<string, unknown>) => string;
  onFeatureClick?: (props: Record<string, unknown>) => void;
  cluster?: boolean;
}

export interface MapHandle {
  fitTo: (bounds: [[number, number], [number, number]]) => void;
  flyTo: (lat: number, lng: number, zoom?: number) => void;
  getDrawnArea: () => number;
  clearDrawing: () => void;
  map: () => L.Map | null;
}

interface MapViewProps {
  layers: MapLayerSpec[];
  center?: [number, number];
  zoom?: number;
  height?: number | string;
  satellite?: boolean;
  drawMode?: 'none' | 'polygon' | 'measure';
  onDrawComplete?: (areaHa: number, perimeterKm: number) => void;
  className?: string;
}

const SATELLITE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

/**
 * Thin imperative Leaflet wrapper. Working directly with the Leaflet API keeps
 * the layer catalogue, drawing tools and GeoJSON re-rendering fully under our
 * control, which matters when tens of thousands of parcels are toggled.
 */
export const MapView = forwardRef<MapHandle, MapViewProps>(function MapView(
  {
    layers,
    center = [23.5, 79.5],
    zoom = 5,
    height = 520,
    satellite = false,
    drawMode = 'none',
    onDrawComplete,
    className,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseRef = useRef<L.TileLayer | null>(null);
  const layerGroups = useRef<Map<string, L.LayerGroup>>(new Map());
  const drawPoints = useRef<L.LatLng[]>([]);
  const drawLayer = useRef<L.LayerGroup | null>(null);

  useImperativeHandle(ref, () => ({
    fitTo: (bounds) => mapRef.current?.fitBounds(bounds, { padding: [24, 24] }),
    flyTo: (lat, lng, z = 15) => mapRef.current?.flyTo([lat, lng], z, { duration: 0.8 }),
    getDrawnArea: () => computeArea(drawPoints.current),
    clearDrawing: () => {
      drawPoints.current = [];
      drawLayer.current?.clearLayers();
    },
    map: () => mapRef.current,
  }));

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center,
      zoom,
      zoomControl: true,
      attributionControl: true,
      preferCanvas: true,
    });
    mapRef.current = map;
    baseRef.current = L.tileLayer(appConfig.tileUrl, {
      attribution: appConfig.tileAttribution,
      maxZoom: 19,
    }).addTo(map);
    drawLayer.current = L.layerGroup().addTo(map);
    L.control.scale({ imperial: false }).addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
      layerGroups.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !baseRef.current) return;
    baseRef.current.setUrl(satellite ? SATELLITE_URL : appConfig.tileUrl);
  }, [satellite]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const spec of layers) {
      const existing = layerGroups.current.get(spec.id);
      if (existing) {
        map.removeLayer(existing);
        layerGroups.current.delete(spec.id);
      }
      if (!spec.visible || !spec.data.features.length) continue;

      const group = L.layerGroup();
      const geoJson = L.geoJSON(spec.data as never, {
        style: () => ({
          color: spec.style.color,
          weight: spec.style.weight,
          fillColor: spec.style.fillColor ?? spec.style.color,
          fillOpacity: spec.style.fillOpacity ?? 0.18,
          dashArray: spec.style.dashArray,
        }),
        pointToLayer: (_f, latlng) =>
          L.circleMarker(latlng, {
            radius: 5,
            color: spec.style.color,
            fillColor: spec.style.fillColor ?? spec.style.color,
            fillOpacity: 0.85,
            weight: 1.5,
          }),
        onEachFeature: (feature, layer) => {
          const props = (feature.properties ?? {}) as Record<string, unknown>;
          if (spec.popup) layer.bindPopup(spec.popup(props), { maxWidth: 320 });
          if (spec.onFeatureClick) layer.on('click', () => spec.onFeatureClick!(props));
          layer.on('mouseover', () => {
            if ('setStyle' in layer) (layer as L.Path).setStyle({ weight: spec.style.weight + 1.5 });
          });
          layer.on('mouseout', () => {
            if ('setStyle' in layer) (layer as L.Path).setStyle({ weight: spec.style.weight });
          });
        },
      });
      group.addLayer(geoJson);
      group.addTo(map);
      layerGroups.current.set(spec.id, group);
    }
  }, [layers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const onClick = (e: L.LeafletMouseEvent) => {
      if (drawMode === 'none') return;
      drawPoints.current.push(e.latlng);
      redraw();
    };
    const onDblClick = () => {
      if (drawMode === 'none' || drawPoints.current.length < 3) return;
      onDrawComplete?.(computeArea(drawPoints.current), computePerimeter(drawPoints.current));
    };

    const redraw = () => {
      drawLayer.current?.clearLayers();
      if (drawPoints.current.length === 0) return;
      drawPoints.current.forEach((p) =>
        drawLayer.current?.addLayer(
          L.circleMarker(p, { radius: 4, color: THEME.red, fillOpacity: 1 }),
        ),
      );
      if (drawPoints.current.length >= 2) {
        drawLayer.current?.addLayer(
          drawMode === 'measure'
            ? L.polyline(drawPoints.current, { color: THEME.red, weight: 2, dashArray: '4 4' })
            : L.polygon(drawPoints.current, { color: THEME.red, weight: 2, fillOpacity: 0.12 }),
        );
      }
    };

    map.on('click', onClick);
    map.on('dblclick', onDblClick);
    if (drawMode !== 'none') map.doubleClickZoom.disable();
    else map.doubleClickZoom.enable();

    return () => {
      map.off('click', onClick);
      map.off('dblclick', onDblClick);
    };
  }, [drawMode, onDrawComplete]);

  return <div ref={containerRef} className={className} style={{ height, width: '100%' }} />;
});

function computeArea(points: L.LatLng[]): number {
  if (points.length < 3) return 0;
  const latRef = (points.reduce((s, p) => s + p.lat, 0) / points.length) * (Math.PI / 180);
  const mPerDegLat = 110_574;
  const mPerDegLon = 111_320 * Math.cos(latRef);
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.lng * mPerDegLon * (b.lat * mPerDegLat) - b.lng * mPerDegLon * (a.lat * mPerDegLat);
  }
  return Math.abs(sum / 2) / 10_000;
}

function computePerimeter(points: L.LatLng[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) total += points[i - 1].distanceTo(points[i]);
  return total / 1000;
}
