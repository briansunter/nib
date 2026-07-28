import { geoContains, geoEquirectangular, geoPath } from 'd3-geo';
import travelGeometry from '../data/travel/travel-geometry.json';
import { parseDatasetJSON } from '../lib/html-utils';
import type { TravelMapCity, TravelMapPayload } from '../lib/travel/page-data';
import { applyFullscreenState } from './fullscreen-toggle';

type TravelGeometry = {
  countries: GeoJSON.FeatureCollection;
  states: GeoJSON.FeatureCollection;
  chinaProvinces: GeoJSON.FeatureCollection;
};

type TravelMapInstance = {
  container: HTMLElement;
  controller: AbortController;
  fullscreenButton?: HTMLButtonElement;
  fullscreenPanel?: HTMLElement;
};

type ProjectedCity = TravelMapCity & {
  x: number;
  y: number;
};

type PanOffset = {
  x: number;
  y: number;
};

type DragState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  origin: PanOffset;
};

type ActivePointer = {
  clientX: number;
  clientY: number;
  pointerType: string;
};

type PinchState = {
  pointerIds: [number, number];
  startDistance: number;
  startZoom: number;
  anchorWorld: PanOffset;
};

const PINCH_MIN_DISTANCE = 16;

type LabelKind = 'country' | 'state';

type LabelOffset = {
  x: number;
  y: number;
};

type LabelBounds = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

type ViewBoxMetrics = {
  scale: number;
  width: number;
  height: number;
  xOffset: number;
  yOffset: number;
};

const EMPTY_PAYLOAD: TravelMapPayload = {
  highlightedCountryIds: [],
  highlightedStateIds: [],
  highlightedChinaProvinceIds: [],
  cities: [],
};
const TOUCH_POINTER_TYPE = 'touch';
const SVG_NS = 'http://www.w3.org/2000/svg';
const VIEWBOX_WIDTH = 1200;
const VIEWBOX_HEIGHT = 620;
const VIEWBOX_CENTER = {
  x: VIEWBOX_WIDTH / 2,
  y: VIEWBOX_HEIGHT / 2,
};
const MIN_ZOOM = 1;
const MAX_ZOOM = 128;
const ZOOM_STEP = 0.5;
const WHEEL_BASE_ZOOM_STEP = 0.5;
const VISITED_COUNTRY_LABEL_MIN_ZOOM = 1.5;
const UNVISITED_COUNTRY_LABEL_MIN_ZOOM = 2.25;
const VISITED_STATE_LABEL_MIN_ZOOM = 2;
const UNVISITED_STATE_LABEL_MIN_ZOOM = 2.5;
const COUNTRY_LABEL_FONT_SIZE = 10.75;
const STATE_LABEL_FONT_SIZE = 8.5;
const LABEL_MAX_GROWTH = 1.65;
const LABEL_GROWTH_START_ZOOM = 3;
const MOBILE_LABEL_SCALE_THRESHOLD = 0.86;
const MOBILE_LABEL_MAX_BOOST = 1;
const MOBILE_LABEL_RAMP_ZOOM = 2;
const MOBILE_LABEL_GROWTH_DAMPING = 0.4;
const LABEL_HALO_WIDTH = 3;
const COUNTRY_LABEL_OFFSET = 5;
const STATE_LABEL_OFFSET = 3.5;
const MOBILE_LABEL_OFFSET_BOOST = 0.45;
const MARKER_RADIUS = 3.25;
const MARKER_MAX_RADIUS = 6.25;
const MARKER_ZOOM_GROWTH = 0.95;
const MOBILE_MARKER_RADIUS_BOOST = 0.42;
const MARKER_HIT_RADIUS = 12;
const MOBILE_MARKER_HIT_RADIUS_BOOST = 0.45;

let activeMap: TravelMapInstance | null = null;

const {
  countries: renderedWorldCountries,
  states: usStates,
  chinaProvinces: renderedChinaProvinces,
} = travelGeometry as unknown as TravelGeometry;
const projection = geoEquirectangular().fitExtent(
  [
    [16, 16],
    [VIEWBOX_WIDTH - 16, VIEWBOX_HEIGHT - 16],
  ],
  { type: 'Sphere' },
);
const pathGenerator = geoPath(projection);

function createSvgElement<K extends keyof SVGElementTagNameMap>(
  tagName: K,
): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NS, tagName);
}

function svgNumber(value: number): string {
  return Number(value.toFixed(3)).toString();
}

function featureId(featureValue: GeoJSON.Feature | undefined): string {
  const id = featureValue?.id;
  if (id === undefined || id === null) return '';
  return String(id).padStart(3, '0');
}

function stateFeatureId(featureValue: GeoJSON.Feature | undefined): string {
  const id = featureValue?.id;
  if (id === undefined || id === null) return '';
  return String(id).padStart(2, '0');
}

function chinaProvinceFeatureId(
  featureValue: GeoJSON.Feature | undefined,
): string {
  const properties = featureValue?.properties;
  const id = properties?.id;
  if (id === undefined || id === null) return '';
  return String(id);
}

function featureName(featureValue: GeoJSON.Feature): string {
  const name = featureValue.properties?.name;
  return typeof name === 'string' ? name : '';
}

function isTravelMapPayload(value: unknown): value is TravelMapPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as TravelMapPayload).cities)
  );
}

function readPayload(container: HTMLElement): TravelMapPayload {
  return parseDatasetJSON<TravelMapPayload>(
    container,
    'travelMap',
    EMPTY_PAYLOAD,
    isTravelMapPayload,
  );
}

function projectCity(city: TravelMapCity): ProjectedCity | null {
  const point = projection([city.lng, city.lat]);
  if (!point) return null;
  return {
    ...city,
    x: point[0],
    y: point[1],
  };
}

function transformedCoordinate(value: number, center: number, zoom: number) {
  return center + (value - center) * zoom;
}

function clampPan(pan: PanOffset, zoom: number): PanOffset {
  const xLimit = ((zoom - MIN_ZOOM) * VIEWBOX_WIDTH) / 2;
  const yLimit = ((zoom - MIN_ZOOM) * VIEWBOX_HEIGHT) / 2;

  return {
    x: Math.max(-xLimit, Math.min(xLimit, pan.x)),
    y: Math.max(-yLimit, Math.min(yLimit, pan.y)),
  };
}

function setLayerTransform(
  layer: SVGGElement,
  zoom: number,
  pan: PanOffset,
): void {
  layer.setAttribute(
    'transform',
    `translate(${pan.x} ${pan.y}) translate(${VIEWBOX_CENTER.x} ${VIEWBOX_CENTER.y}) scale(${zoom}) translate(${-VIEWBOX_CENTER.x} ${-VIEWBOX_CENTER.y})`,
  );
}

function transformedCityPoint(
  city: ProjectedCity,
  zoom: number,
  pan: PanOffset,
) {
  return {
    x: pan.x + transformedCoordinate(city.x, VIEWBOX_CENTER.x, zoom),
    y: pan.y + transformedCoordinate(city.y, VIEWBOX_CENTER.y, zoom),
  };
}

function setButtonState(
  zoomInButton: HTMLButtonElement,
  zoomOutButton: HTMLButtonElement,
  zoom: number,
): void {
  zoomInButton.disabled = zoom >= MAX_ZOOM;
  zoomOutButton.disabled = zoom <= MIN_ZOOM;
}

function setMapFullscreen(
  panel: HTMLElement,
  button: HTMLButtonElement | undefined,
  isFullscreen: boolean,
): void {
  applyFullscreenState(
    {
      wrapper: panel,
      button: button ?? null,
      bodyClass: 'travel-map-fullscreen-open',
      enterLabel: 'Enter fullscreen map',
      exitLabel: 'Exit fullscreen map',
    },
    isFullscreen,
  );
}

function buttonZoomStep(currentZoom: number): number {
  if (currentZoom < 3) return ZOOM_STEP;
  if (currentZoom < 8) return 1;
  if (currentZoom < 16) return 2;
  if (currentZoom < 32) return 4;
  if (currentZoom < 64) return 8;
  return 16;
}

function wheelZoomStep(currentZoom: number): number {
  if (currentZoom < 4) return WHEEL_BASE_ZOOM_STEP;
  if (currentZoom < 12) return 1;
  if (currentZoom < 32) return 2;
  if (currentZoom < 64) return 4;
  return 8;
}

function zoomPanForFocus(
  currentPan: PanOffset,
  currentZoom: number,
  nextZoom: number,
  focus: PanOffset,
): PanOffset {
  if (currentZoom === nextZoom) return currentPan;

  const zoomRatio = nextZoom / currentZoom;
  return {
    x:
      focus.x -
      VIEWBOX_CENTER.x -
      (focus.x - currentPan.x - VIEWBOX_CENTER.x) * zoomRatio,
    y:
      focus.y -
      VIEWBOX_CENTER.y -
      (focus.y - currentPan.y - VIEWBOX_CENTER.y) * zoomRatio,
  };
}

function clientToViewBoxPoint(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): PanOffset {
  const rect = svg.getBoundingClientRect();
  const metrics = viewBoxMetrics(svg);
  if (metrics.scale <= 0) return VIEWBOX_CENTER;

  return {
    x: (clientX - rect.left - metrics.xOffset) / metrics.scale,
    y: (clientY - rect.top - metrics.yOffset) / metrics.scale,
  };
}

function clientPointToViewBoxPoint(
  svg: SVGSVGElement,
  event: MouseEvent | WheelEvent,
): PanOffset {
  return clientToViewBoxPoint(svg, event.clientX, event.clientY);
}

function viewBoxPointToWorld(
  point: PanOffset,
  zoom: number,
  pan: PanOffset,
): PanOffset {
  return {
    x: VIEWBOX_CENTER.x + (point.x - pan.x - VIEWBOX_CENTER.x) / zoom,
    y: VIEWBOX_CENTER.y + (point.y - pan.y - VIEWBOX_CENTER.y) / zoom,
  };
}

function panForWorldAtViewport(
  world: PanOffset,
  viewport: PanOffset,
  zoom: number,
): PanOffset {
  return {
    x: viewport.x - VIEWBOX_CENTER.x - (world.x - VIEWBOX_CENTER.x) * zoom,
    y: viewport.y - VIEWBOX_CENTER.y - (world.y - VIEWBOX_CENTER.y) * zoom,
  };
}

function viewBoxMetrics(svg: SVGSVGElement): ViewBoxMetrics {
  const rect = svg.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return {
      scale: 1,
      width: VIEWBOX_WIDTH,
      height: VIEWBOX_HEIGHT,
      xOffset: 0,
      yOffset: 0,
    };
  }

  const scale = Math.min(
    rect.width / VIEWBOX_WIDTH,
    rect.height / VIEWBOX_HEIGHT,
  );
  return {
    scale,
    width: rect.width,
    height: rect.height,
    xOffset: (rect.width - VIEWBOX_WIDTH * scale) / 2,
    yOffset: (rect.height - VIEWBOX_HEIGHT * scale) / 2,
  };
}

function mobileLabelBoost(cssScale: number): number {
  if (cssScale >= MOBILE_LABEL_SCALE_THRESHOLD) return 1;

  return Math.min(
    MOBILE_LABEL_MAX_BOOST,
    1 + (MOBILE_LABEL_SCALE_THRESHOLD - cssScale) * 0.55,
  );
}

function mobileViewportProgress(cssScale: number): number {
  if (cssScale >= MOBILE_LABEL_SCALE_THRESHOLD) return 0;

  return Math.max(
    0,
    Math.min(1, (MOBILE_LABEL_SCALE_THRESHOLD - cssScale) / 0.54),
  );
}

function adjustedLabelMinZoom(
  label: SVGTextElement,
  minZoom: number,
  cssScale: number,
): number {
  const progress = mobileViewportProgress(cssScale);
  if (progress <= 0) return minZoom;

  const isState = label.dataset.labelKind === 'state';
  const isVisited = label.dataset.isVisited === 'true';
  const delay = isState ? (isVisited ? 4.8 : 12) : isVisited ? 1.4 : 8;
  const mobileFloor = isState
    ? isVisited
      ? 6 + progress * 2
      : 10 + progress * 5
    : isVisited
      ? 4 + progress * 1.5
      : 8 + progress * 4;

  return Math.max(minZoom + delay * progress, mobileFloor);
}

function labelRampBoost(
  zoom: number,
  minZoom: number,
  targetBoost: number,
): number {
  if (targetBoost <= 1 || zoom <= minZoom) return 1;

  const progress = Math.max(
    0,
    Math.min(1, (zoom - minZoom) / MOBILE_LABEL_RAMP_ZOOM),
  );
  return 1 + (targetBoost - 1) * progress;
}

function labelPriority(label: SVGTextElement): number {
  const isState = label.dataset.labelKind === 'state';
  const isVisited = label.dataset.isVisited === 'true';
  if (isVisited && !isState) return 0;
  if (isVisited && isState) return 1;
  if (!isVisited && !isState) return 2;
  return 3;
}

function labelBounds(
  label: SVGTextElement,
  zoom: number,
  pan: PanOffset,
  metrics: ViewBoxMetrics,
): LabelBounds | null {
  const x = Number(label.getAttribute('x')) + Number(label.getAttribute('dx'));
  const y = Number(label.getAttribute('y')) + Number(label.getAttribute('dy'));
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  const viewX = pan.x + transformedCoordinate(x, VIEWBOX_CENTER.x, zoom);
  const viewY = pan.y + transformedCoordinate(y, VIEWBOX_CENTER.y, zoom);
  const screenFontSize =
    Number(label.getAttribute('font-size')) * zoom * metrics.scale;
  if (!Number.isFinite(screenFontSize) || screenFontSize <= 0) return null;

  const textLength = label.textContent?.length ?? 0;
  const width = Math.max(18, textLength * screenFontSize * 0.56);
  const height = screenFontSize * 1.1;
  const centerX = metrics.xOffset + viewX * metrics.scale;
  const centerY = metrics.yOffset + viewY * metrics.scale;
  const bounds = {
    left: centerX - width / 2,
    right: centerX + width / 2,
    top: centerY - height / 2,
    bottom: centerY + height / 2,
  };

  if (
    bounds.right < -24 ||
    bounds.left > metrics.width + 24 ||
    bounds.bottom < -24 ||
    bounds.top > metrics.height + 24
  ) {
    return null;
  }

  return bounds;
}

function boundsOverlap(first: LabelBounds, second: LabelBounds): boolean {
  const margin = 4;
  return !(
    first.right + margin < second.left ||
    second.right + margin < first.left ||
    first.bottom + margin < second.top ||
    second.bottom + margin < first.top
  );
}

function cullMobileLabels(
  layer: SVGGElement,
  zoom: number,
  pan: PanOffset,
  metrics: ViewBoxMetrics,
): void {
  const candidates = [
    ...layer.querySelectorAll<SVGTextElement>('.travel-map-label.is-visible'),
  ].sort((first, second) => labelPriority(first) - labelPriority(second));
  const acceptedBounds: LabelBounds[] = [];

  for (const label of candidates) {
    const bounds = labelBounds(label, zoom, pan, metrics);
    if (!bounds) {
      label.classList.remove('is-visible');
      continue;
    }

    if (acceptedBounds.some((accepted) => boundsOverlap(bounds, accepted))) {
      label.classList.remove('is-visible');
      continue;
    }

    acceptedBounds.push(bounds);
  }
}

function positionPopup(
  popup: HTMLElement,
  city: ProjectedCity,
  zoom: number,
  pan: PanOffset,
): void {
  const point = transformedCityPoint(city, zoom, pan);
  popup.style.left = `${(point.x / VIEWBOX_WIDTH) * 100}%`;
  popup.style.top = `${(point.y / VIEWBOX_HEIGHT) * 100}%`;
}

function clearPopup(container: HTMLElement): void {
  container.querySelector('.travel-map-popup-floating')?.remove();
}

function showPopup(
  container: HTMLElement,
  city: ProjectedCity,
  zoom: number,
  pan: PanOffset,
): HTMLElement {
  clearPopup(container);

  const popup = document.createElement('div');
  popup.className = 'travel-map-popup-floating';
  popup.setAttribute('role', 'status');

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'travel-map-popup-close';
  closeButton.setAttribute('aria-label', 'Close map popup');
  closeButton.textContent = 'x';
  closeButton.addEventListener('click', () => {
    clearPopup(container);
  });

  const title = document.createElement('strong');
  title.textContent = city.name;

  const region = document.createElement('span');
  region.textContent = city.region;

  popup.append(closeButton, title, region);
  container.append(popup);
  positionPopup(popup, city, zoom, pan);
  return popup;
}

function isMarkerTarget(event: PointerEvent): boolean {
  return (
    event.target instanceof Element &&
    event.target.closest('.travel-map-marker, .travel-map-marker-hit') !== null
  );
}

function clientDeltaToViewBoxDelta(
  svg: SVGSVGElement,
  deltaX: number,
  deltaY: number,
): PanOffset {
  const metrics = viewBoxMetrics(svg);
  const scale = metrics.scale > 0 ? metrics.scale : 1;

  return {
    x: deltaX / scale,
    y: deltaY / scale,
  };
}

function capturePointer(svg: SVGSVGElement, pointerId: number): void {
  try {
    svg.setPointerCapture?.(pointerId);
  } catch {
    // Synthetic pointer events used by tests and DevTools are not always active.
  }
}

function releasePointer(svg: SVGSVGElement, pointerId: number): void {
  try {
    svg.releasePointerCapture?.(pointerId);
  } catch {
    // Ignore releases for synthetic or already-released pointers.
  }
}

function isTouchPointer(event: PointerEvent): boolean {
  return event.pointerType === TOUCH_POINTER_TYPE;
}

function makePath(
  featureValue: GeoJSON.Feature,
  className: string,
): SVGPathElement | null {
  const pathData = pathGenerator(featureValue);
  if (!pathData) return null;

  const path = createSvgElement('path');
  path.setAttribute('class', className);
  path.setAttribute('d', pathData);
  return path;
}

function featureContainsCity(
  featureValue: GeoJSON.Feature,
  city: ProjectedCity,
): boolean {
  try {
    return geoContains(featureValue, [city.lng, city.lat]);
  } catch {
    return false;
  }
}

function averageCityPoint(cities: ProjectedCity[]): { x: number; y: number } {
  const totals = cities.reduce(
    (accumulator, city) => ({
      x: accumulator.x + city.x,
      y: accumulator.y + city.y,
    }),
    { x: 0, y: 0 },
  );

  return {
    x: totals.x / cities.length,
    y: totals.y / cities.length,
  };
}

function projectPosition(position: GeoJSON.Position): [number, number] | null {
  const [longitude, latitude] = position;
  if (typeof longitude !== 'number' || typeof latitude !== 'number') {
    return null;
  }

  return projection([longitude, latitude]);
}

function projectedRingArea(ring: GeoJSON.Position[]): number {
  let area = 0;

  for (let index = 0; index < ring.length; index += 1) {
    const current = projectPosition(ring[index]);
    const next = projectPosition(ring[(index + 1) % ring.length]);
    if (!current || !next) continue;
    area += current[0] * next[1] - next[0] * current[1];
  }

  return Math.abs(area) / 2;
}

function largestProjectedPolygon(
  featureValue: GeoJSON.Feature,
): GeoJSON.Position[][] | null {
  const { geometry } = featureValue;
  if (!geometry) return null;

  const polygons =
    geometry.type === 'Polygon'
      ? [geometry.coordinates]
      : geometry.type === 'MultiPolygon'
        ? geometry.coordinates
        : [];

  let largestPolygon: GeoJSON.Position[][] | null = null;
  let largestArea = 0;

  for (const polygon of polygons) {
    const area = projectedRingArea(polygon[0] ?? []);
    if (area <= largestArea) continue;
    largestPolygon = polygon;
    largestArea = area;
  }

  return largestPolygon;
}

function labelAnchorForFeature(
  featureValue: GeoJSON.Feature,
): [number, number] {
  const largestPolygon = largestProjectedPolygon(featureValue);
  if (largestPolygon) {
    const largestPolygonFeature: GeoJSON.Feature = {
      ...featureValue,
      geometry: {
        type: 'Polygon',
        coordinates: largestPolygon,
      },
    };
    const largestPolygonCentroid = pathGenerator.centroid(
      largestPolygonFeature,
    );

    if (
      Number.isFinite(largestPolygonCentroid[0]) &&
      Number.isFinite(largestPolygonCentroid[1])
    ) {
      return largestPolygonCentroid;
    }
  }

  return pathGenerator.centroid(featureValue);
}

function labelOffsetForFeature(
  featureValue: GeoJSON.Feature,
  kind: LabelKind,
  cities: ProjectedCity[],
  anchor: [number, number],
): LabelOffset {
  const nearbyCities = cities.filter((city) =>
    featureContainsCity(featureValue, city),
  );
  if (nearbyCities.length === 0) return { x: 0, y: 0 };

  const averageMarker = averageCityPoint(nearbyCities);
  const rawOffset = {
    x: anchor[0] - averageMarker.x,
    y: anchor[1] - averageMarker.y,
  };
  const magnitude = Math.hypot(rawOffset.x, rawOffset.y);
  const direction =
    magnitude < 1
      ? { x: 0, y: -1 }
      : { x: rawOffset.x / magnitude, y: rawOffset.y / magnitude };
  const offsetDistance =
    kind === 'country' ? COUNTRY_LABEL_OFFSET : STATE_LABEL_OFFSET;

  return {
    x: direction.x * offsetDistance,
    y: direction.y * offsetDistance,
  };
}

function makeLabel(
  featureValue: GeoJSON.Feature,
  kind: LabelKind,
  cities: ProjectedCity[],
  isVisited: boolean,
): SVGTextElement | null {
  const name = featureName(featureValue);
  if (!name) return null;

  const [x, y] = labelAnchorForFeature(featureValue);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  const text = createSvgElement('text');
  text.setAttribute(
    'class',
    `travel-map-label travel-${kind}-label ${
      isVisited ? 'is-visited' : 'is-unvisited'
    }`,
  );
  text.setAttribute('x', String(x));
  text.setAttribute('y', String(y));
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('dominant-baseline', 'middle');
  text.setAttribute('aria-hidden', 'true');
  const offset = labelOffsetForFeature(featureValue, kind, cities, [x, y]);
  text.dataset.offsetX = svgNumber(offset.x);
  text.dataset.offsetY = svgNumber(offset.y);
  text.dataset.labelKind = kind;
  text.dataset.isVisited = String(isVisited);
  text.dataset.minZoom = String(
    kind === 'country'
      ? isVisited
        ? VISITED_COUNTRY_LABEL_MIN_ZOOM
        : UNVISITED_COUNTRY_LABEL_MIN_ZOOM
      : isVisited
        ? VISITED_STATE_LABEL_MIN_ZOOM
        : UNVISITED_STATE_LABEL_MIN_ZOOM,
  );
  text.dataset.baseFontSize = String(
    kind === 'country'
      ? isVisited
        ? COUNTRY_LABEL_FONT_SIZE
        : COUNTRY_LABEL_FONT_SIZE * 0.9
      : isVisited
        ? STATE_LABEL_FONT_SIZE
        : STATE_LABEL_FONT_SIZE * 0.88,
  );
  text.textContent = name;
  return text;
}

function updateLabels(
  layer: SVGGElement,
  zoom: number,
  metrics: ViewBoxMetrics,
  pan: PanOffset,
): void {
  const viewportScale = metrics.scale > 0 ? metrics.scale : 1;
  const targetScreenBoost = mobileLabelBoost(viewportScale);
  const viewportProgress = mobileViewportProgress(viewportScale);
  const rawLabelScale =
    zoom <= LABEL_GROWTH_START_ZOOM
      ? 1
      : Math.min(
          LABEL_MAX_GROWTH,
          1 + Math.log2(zoom / LABEL_GROWTH_START_ZOOM) * 0.22,
        );
  const labelScale =
    1 +
    (rawLabelScale - 1) *
      (1 - viewportProgress * (1 - MOBILE_LABEL_GROWTH_DAMPING));
  const labelOffsetBoost = 1 + viewportProgress * MOBILE_LABEL_OFFSET_BOOST;

  for (const label of layer.querySelectorAll<SVGTextElement>(
    '.travel-map-label',
  )) {
    const minZoom = Number(
      label.dataset.minZoom ?? VISITED_COUNTRY_LABEL_MIN_ZOOM,
    );
    const visibleZoom = adjustedLabelMinZoom(label, minZoom, viewportScale);
    const screenBoost = labelRampBoost(zoom, visibleZoom, targetScreenBoost);
    const baseFontSize = Number(
      label.dataset.baseFontSize ?? COUNTRY_LABEL_FONT_SIZE,
    );
    label.classList.toggle('is-visible', zoom >= visibleZoom);
    label.setAttribute(
      'font-size',
      svgNumber(
        (baseFontSize * labelScale * screenBoost) / zoom / viewportScale,
      ),
    );
    label.setAttribute(
      'stroke-width',
      svgNumber(
        (LABEL_HALO_WIDTH * labelScale * screenBoost) / zoom / viewportScale,
      ),
    );
    label.setAttribute(
      'dx',
      svgNumber(
        (Number(label.dataset.offsetX ?? 0) * screenBoost * labelOffsetBoost) /
          zoom /
          viewportScale,
      ),
    );
    label.setAttribute(
      'dy',
      svgNumber(
        (Number(label.dataset.offsetY ?? 0) * screenBoost * labelOffsetBoost) /
          zoom /
          viewportScale,
      ),
    );
  }

  if (viewportProgress > 0) {
    cullMobileLabels(layer, zoom, pan, metrics);
  }
}

function updateMarkers(
  layer: SVGGElement,
  zoom: number,
  metrics: ViewBoxMetrics,
): void {
  const viewportScale = metrics.scale > 0 ? metrics.scale : 1;
  const viewportProgress = mobileViewportProgress(viewportScale);
  const screenRadius =
    Math.min(
      MARKER_MAX_RADIUS,
      MARKER_RADIUS + Math.log2(zoom) * MARKER_ZOOM_GROWTH,
    ) *
    (1 + viewportProgress * MOBILE_MARKER_RADIUS_BOOST);
  const hitScreenRadius =
    MARKER_HIT_RADIUS * (1 + viewportProgress * MOBILE_MARKER_HIT_RADIUS_BOOST);
  const radius = screenRadius / zoom / viewportScale;
  const hitRadius = hitScreenRadius / zoom / viewportScale;

  for (const hitTarget of layer.querySelectorAll<SVGCircleElement>(
    '.travel-map-marker-hit',
  )) {
    hitTarget.setAttribute('r', svgNumber(hitRadius));
  }

  for (const marker of layer.querySelectorAll<SVGCircleElement>(
    '.travel-map-marker',
  )) {
    marker.setAttribute('r', svgNumber(radius));
  }
}

function drawCountries(
  layer: SVGGElement,
  highlightedCountryIds: Set<string>,
): void {
  const group = createSvgElement('g');
  group.setAttribute('class', 'travel-country-layer');
  group.setAttribute('aria-hidden', 'true');

  for (const country of renderedWorldCountries.features) {
    const isVisited = highlightedCountryIds.has(featureId(country));
    const path = makePath(
      country,
      isVisited ? 'travel-country is-visited' : 'travel-country',
    );
    if (path) group.append(path);
  }

  layer.append(group);
}

function drawStates(
  layer: SVGGElement,
  highlightedStateIds: Set<string>,
): void {
  const group = createSvgElement('g');
  group.setAttribute('class', 'travel-state-layer');
  group.setAttribute('aria-hidden', 'true');

  for (const state of usStates.features) {
    const isVisited = highlightedStateIds.has(stateFeatureId(state));
    const path = makePath(
      state,
      isVisited ? 'travel-state is-visited' : 'travel-state',
    );
    if (path) group.append(path);
  }

  layer.append(group);
}

function drawChinaProvinces(
  layer: SVGGElement,
  highlightedProvinceIds: Set<string>,
): void {
  const group = createSvgElement('g');
  group.setAttribute('class', 'travel-china-province-layer');
  group.setAttribute('aria-hidden', 'true');

  for (const province of renderedChinaProvinces.features) {
    const isVisited = highlightedProvinceIds.has(
      chinaProvinceFeatureId(province),
    );
    const path = makePath(
      province,
      isVisited
        ? 'travel-state travel-china-province is-visited'
        : 'travel-state travel-china-province',
    );
    if (path) group.append(path);
  }

  layer.append(group);
}

function drawLabels(
  layer: SVGGElement,
  highlightedCountryIds: Set<string>,
  highlightedStateIds: Set<string>,
  highlightedChinaProvinceIds: Set<string>,
  cities: ProjectedCity[],
): void {
  const group = createSvgElement('g');
  group.setAttribute('class', 'travel-label-layer');
  group.setAttribute('aria-hidden', 'true');

  for (const country of renderedWorldCountries.features) {
    const isVisited = highlightedCountryIds.has(featureId(country));
    const label = makeLabel(country, 'country', cities, isVisited);
    if (label) group.append(label);
  }

  for (const state of usStates.features) {
    const isVisited = highlightedStateIds.has(stateFeatureId(state));
    const label = makeLabel(state, 'state', cities, isVisited);
    if (label) group.append(label);
  }

  for (const province of renderedChinaProvinces.features) {
    const isVisited = highlightedChinaProvinceIds.has(
      chinaProvinceFeatureId(province),
    );
    const label = makeLabel(province, 'state', cities, isVisited);
    if (label) group.append(label);
  }

  layer.append(group);
}

function drawMarkers(
  container: HTMLElement,
  layer: SVGGElement,
  cities: ProjectedCity[],
  controller: AbortController,
  getZoom: () => number,
  getPan: () => PanOffset,
  setActiveCity: (city: ProjectedCity | null) => void,
): void {
  const group = createSvgElement('g');
  group.setAttribute('class', 'travel-marker-layer');

  for (const city of cities) {
    const markerHit = createSvgElement('circle');
    markerHit.setAttribute('class', 'travel-map-marker-hit');
    markerHit.setAttribute('cx', String(city.x));
    markerHit.setAttribute('cy', String(city.y));
    markerHit.setAttribute('r', String(MARKER_HIT_RADIUS));
    markerHit.setAttribute('aria-hidden', 'true');
    markerHit.setAttribute('focusable', 'false');

    const marker = createSvgElement('circle');
    marker.setAttribute('class', 'travel-map-marker');
    marker.setAttribute('cx', String(city.x));
    marker.setAttribute('cy', String(city.y));
    marker.setAttribute('r', String(MARKER_RADIUS));
    marker.setAttribute('tabindex', '0');
    marker.setAttribute('role', 'button');
    marker.setAttribute('aria-label', `${city.name}, ${city.region}`);

    const openPopup = () => {
      setActiveCity(city);
      showPopup(container, city, getZoom(), getPan());
    };

    markerHit.addEventListener('click', openPopup, {
      signal: controller.signal,
    });
    marker.addEventListener('click', openPopup, {
      signal: controller.signal,
    });
    marker.addEventListener(
      'keydown',
      (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        openPopup();
      },
      { signal: controller.signal },
    );
    group.append(markerHit, marker);
  }

  layer.append(group);
}

export function destroyTravelMap(): void {
  activeMap?.controller.abort();
  if (activeMap?.fullscreenPanel) {
    setMapFullscreen(
      activeMap.fullscreenPanel,
      activeMap.fullscreenButton,
      false,
    );
  }
  if (activeMap?.container) {
    delete activeMap.container.dataset.mapInitialized;
  }
  activeMap = null;
}

export function initTravelMap(containerId = 'travel-map'): HTMLElement | null {
  const container = document.getElementById(containerId);
  if (!container) return null;
  if (container.dataset.mapInitialized === 'true') return container;

  destroyTravelMap();
  container.replaceChildren();

  const payload = readPayload(container);
  const highlightedCountryIds = new Set(payload.highlightedCountryIds);
  const highlightedStateIds = new Set(payload.highlightedStateIds);
  const highlightedChinaProvinceIds = new Set(
    payload.highlightedChinaProvinceIds ?? [],
  );
  const cities = payload.cities
    .map(projectCity)
    .filter((city): city is ProjectedCity => city !== null);
  const controller = new AbortController();
  const fullscreenPanel =
    container.closest<HTMLElement>('.travel-map-panel') ?? container;
  const fullscreenButton =
    fullscreenPanel.querySelector<HTMLButtonElement>(
      '[data-travel-map-fullscreen]',
    ) ?? undefined;
  let zoom = MIN_ZOOM;
  let pan: PanOffset = { x: 0, y: 0 };
  let activeCity: ProjectedCity | null = null;
  let dragState: DragState | null = null;
  let pinchState: PinchState | null = null;
  const activePointers = new Map<number, ActivePointer>();
  let wheelZoomActive = false;

  const svg = createSvgElement('svg');
  svg.setAttribute('class', 'travel-map-svg');
  svg.setAttribute('viewBox', `0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.setAttribute('role', 'group');
  svg.setAttribute(
    'aria-label',
    'Interactive visited places map. Tab to a city marker for details.',
  );
  svg.setAttribute('tabindex', '0');

  const layer = createSvgElement('g');
  layer.setAttribute('class', 'travel-map-layer');

  const applyTransform = () => {
    const metrics = viewBoxMetrics(svg);
    setLayerTransform(layer, zoom, pan);
    updateLabels(layer, zoom, metrics, pan);
    updateMarkers(layer, zoom, metrics);
    const popup = container.querySelector<HTMLElement>(
      '.travel-map-popup-floating',
    );
    if (popup && activeCity) positionPopup(popup, activeCity, zoom, pan);
  };
  const resizeObserver =
    typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => applyTransform());

  drawCountries(layer, highlightedCountryIds);
  drawStates(layer, highlightedStateIds);
  drawChinaProvinces(layer, highlightedChinaProvinceIds);
  drawMarkers(
    container,
    layer,
    cities,
    controller,
    () => zoom,
    () => pan,
    (city) => {
      activeCity = city;
    },
  );
  drawLabels(
    layer,
    highlightedCountryIds,
    highlightedStateIds,
    highlightedChinaProvinceIds,
    cities,
  );
  applyTransform();
  svg.append(layer);

  const controls = document.createElement('div');
  controls.className = 'travel-map-zoom';
  controls.setAttribute('aria-label', 'Map zoom controls');

  const zoomInButton = document.createElement('button');
  zoomInButton.type = 'button';
  zoomInButton.setAttribute('aria-label', 'Zoom in');
  zoomInButton.textContent = '+';

  const zoomOutButton = document.createElement('button');
  zoomOutButton.type = 'button';
  zoomOutButton.setAttribute('aria-label', 'Zoom out');
  zoomOutButton.textContent = '-';

  const updateZoom = (nextZoom: number, focus = VIEWBOX_CENTER) => {
    const clampedZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
    pan = clampPan(zoomPanForFocus(pan, zoom, clampedZoom, focus), clampedZoom);
    zoom = clampedZoom;
    applyTransform();
    setButtonState(zoomInButton, zoomOutButton, zoom);
  };

  const setWheelZoomActive = (isActive: boolean) => {
    wheelZoomActive = isActive;
    svg.classList.toggle('is-wheel-active', isActive);
    if (isActive) svg.focus({ preventScroll: true });
  };

  const updateWheelZoom = (event: WheelEvent) => {
    if (!wheelZoomActive) return;
    event.preventDefault();
    const direction = event.deltaY < 0 ? 1 : -1;
    updateZoom(
      zoom + direction * wheelZoomStep(zoom),
      clientPointToViewBoxPoint(svg, event),
    );
  };

  const pinchMidpoint = (): PanOffset | null => {
    if (!pinchState) return null;
    const [idA, idB] = pinchState.pointerIds;
    const a = activePointers.get(idA);
    const b = activePointers.get(idB);
    if (!a || !b) return null;
    return clientToViewBoxPoint(
      svg,
      (a.clientX + b.clientX) / 2,
      (a.clientY + b.clientY) / 2,
    );
  };

  const pinchDistance = (): number => {
    if (!pinchState) return 0;
    const [idA, idB] = pinchState.pointerIds;
    const a = activePointers.get(idA);
    const b = activePointers.get(idB);
    if (!a || !b) return 0;
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  };

  const touchPointerIds = (): number[] =>
    [...activePointers.entries()]
      .filter(([, pointer]) => pointer.pointerType === TOUCH_POINTER_TYPE)
      .map(([pointerId]) => pointerId);

  const clearTouchGestureState = () => {
    if (pinchState) {
      pinchState = null;
      svg.classList.remove('is-pinching');
    }

    if (
      dragState &&
      activePointers.get(dragState.pointerId)?.pointerType ===
        TOUCH_POINTER_TYPE
    ) {
      releasePointer(svg, dragState.pointerId);
      dragState = null;
      svg.classList.remove('is-dragging');
    }

    for (const [pointerId, pointer] of activePointers) {
      if (pointer.pointerType !== TOUCH_POINTER_TYPE) continue;
      releasePointer(svg, pointerId);
      activePointers.delete(pointerId);
    }
  };

  const startPinch = (): boolean => {
    const [idA, idB] = touchPointerIds();
    if (idA === undefined || idB === undefined) return false;
    // Dragging stops the moment a second finger touches down.
    if (dragState) {
      releasePointer(svg, dragState.pointerId);
      dragState = null;
      svg.classList.remove('is-dragging');
    }
    const a = activePointers.get(idA);
    const b = activePointers.get(idB);
    if (!a || !b) return false;
    const startDistance = Math.hypot(
      a.clientX - b.clientX,
      a.clientY - b.clientY,
    );
    if (startDistance < PINCH_MIN_DISTANCE) return false;
    const startMidpoint = clientToViewBoxPoint(
      svg,
      (a.clientX + b.clientX) / 2,
      (a.clientY + b.clientY) / 2,
    );
    pinchState = {
      pointerIds: [idA, idB],
      startDistance,
      startZoom: zoom,
      anchorWorld: viewBoxPointToWorld(startMidpoint, zoom, pan),
    };
    svg.classList.add('is-pinching');
    return true;
  };

  const updatePinch = () => {
    if (!pinchState) return;
    const midpoint = pinchMidpoint();
    const distance = pinchDistance();
    if (!midpoint || distance <= 0) return;
    const scale = distance / pinchState.startDistance;
    const nextZoom = Math.min(
      MAX_ZOOM,
      Math.max(MIN_ZOOM, pinchState.startZoom * scale),
    );
    const nextPan = clampPan(
      panForWorldAtViewport(pinchState.anchorWorld, midpoint, nextZoom),
      nextZoom,
    );
    zoom = nextZoom;
    pan = nextPan;
    applyTransform();
    setButtonState(zoomInButton, zoomOutButton, zoom);
  };

  const endPinch = () => {
    if (!pinchState) return;
    pinchState = null;
    svg.classList.remove('is-pinching');
    // Two-plus fingers still down (e.g. user lifted one finger of a
    // three-finger gesture): re-snapshot the pinch against the remaining
    // pair so we don't lose the zoom anchor mid-gesture.
    const remainingTouchPointerIds = touchPointerIds();
    if (remainingTouchPointerIds.length >= 2) {
      startPinch();
      return;
    }
    // Exactly one finger remains: transition the gesture into a drag so the
    // map keeps responding without requiring the user to lift and re-touch.
    if (remainingTouchPointerIds.length === 1) {
      const [pointerId] = remainingTouchPointerIds;
      const pointer = activePointers.get(pointerId);
      if (pointer) {
        dragState = {
          pointerId,
          startClientX: pointer.clientX,
          startClientY: pointer.clientY,
          origin: { ...pan },
        };
        capturePointer(svg, pointerId);
        svg.classList.add('is-dragging');
      }
    }
  };

  svg.addEventListener(
    'pointerdown',
    (event) => {
      if (event.button !== 0) return;
      const isTouch = isTouchPointer(event);

      if (isTouch && event.isPrimary) {
        clearTouchGestureState();
      }

      setWheelZoomActive(!isTouch);
      activePointers.set(event.pointerId, {
        clientX: event.clientX,
        clientY: event.clientY,
        pointerType: event.pointerType,
      });
      // A second concurrent pointer transitions an in-progress drag into a
      // pinch-zoom gesture.
      if (touchPointerIds().length >= 2) {
        event.preventDefault();
        if (startPinch()) return;
      }
      if (isMarkerTarget(event)) return;
      event.preventDefault();
      dragState = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        origin: { ...pan },
      };
      capturePointer(svg, event.pointerId);
      svg.classList.add('is-dragging');
    },
    { signal: controller.signal },
  );
  svg.addEventListener(
    'pointermove',
    (event) => {
      const tracked = activePointers.get(event.pointerId);
      if (tracked) {
        tracked.clientX = event.clientX;
        tracked.clientY = event.clientY;
      }
      if (pinchState) {
        event.preventDefault();
        updatePinch();
        return;
      }
      if (!dragState || event.pointerId !== dragState.pointerId) return;
      event.preventDefault();
      const delta = clientDeltaToViewBoxDelta(
        svg,
        event.clientX - dragState.startClientX,
        event.clientY - dragState.startClientY,
      );
      pan = clampPan(
        {
          x: dragState.origin.x + delta.x,
          y: dragState.origin.y + delta.y,
        },
        zoom,
      );
      applyTransform();
    },
    { signal: controller.signal },
  );

  const endPointer = (event: PointerEvent) => {
    activePointers.delete(event.pointerId);
    if (pinchState?.pointerIds.includes(event.pointerId)) {
      releasePointer(svg, event.pointerId);
      endPinch();
      return;
    }
    if (dragState && event.pointerId === dragState.pointerId) {
      releasePointer(svg, event.pointerId);
      dragState = null;
      svg.classList.remove('is-dragging');
    }
  };

  svg.addEventListener('pointerup', endPointer, { signal: controller.signal });
  svg.addEventListener('pointercancel', endPointer, {
    signal: controller.signal,
  });
  svg.addEventListener('wheel', updateWheelZoom, {
    passive: false,
    signal: controller.signal,
  });
  resizeObserver?.observe(svg);
  controller.signal.addEventListener(
    'abort',
    () => {
      resizeObserver?.disconnect();
    },
    { once: true },
  );
  document.addEventListener(
    'pointerdown',
    (event) => {
      if (!(event.target instanceof Node) || container.contains(event.target)) {
        return;
      }
      setWheelZoomActive(false);
    },
    { signal: controller.signal },
  );

  zoomInButton.addEventListener(
    'click',
    () => {
      updateZoom(zoom + buttonZoomStep(zoom));
    },
    { signal: controller.signal },
  );
  zoomOutButton.addEventListener(
    'click',
    () => {
      updateZoom(zoom - buttonZoomStep(zoom));
    },
    { signal: controller.signal },
  );
  fullscreenButton?.addEventListener(
    'click',
    () => {
      const isFullscreen = !fullscreenPanel.classList.contains('is-fullscreen');
      setMapFullscreen(fullscreenPanel, fullscreenButton, isFullscreen);
      applyTransform();
      svg.focus({ preventScroll: true });
    },
    { signal: controller.signal },
  );
  container.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Escape') return;
      clearPopup(container);
      activeCity = null;
      setWheelZoomActive(false);
      setMapFullscreen(fullscreenPanel, fullscreenButton, false);
    },
    { signal: controller.signal },
  );

  controls.append(zoomInButton, zoomOutButton);
  container.append(svg, controls);
  setButtonState(zoomInButton, zoomOutButton, zoom);

  activeMap = { container, controller, fullscreenButton, fullscreenPanel };
  container.dataset.mapInitialized = 'true';
  return container;
}
