/**
 * Pure geometry + decision helpers for the pin-collection multi-marker
 * map. Everything here is plain math on numbers - no Leaflet, no DOM -
 * so the rules around cluster spread and label collision can be tested
 * in isolation and reused without ceremony.
 *
 * The Leaflet glue in `mapInitializer.ts` is responsible for projecting
 * lat/lng to container points, applying classes, and calling
 * `marker.setLatLng`; everything geometric flows through this module.
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface Rect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// --- Layout constants shared with the CSS + Leaflet icon anchor. -----------

/**
 * iconAnchor[1] from `buildPinMarkerIcon` - y-offset from marker origin to
 * the tip of the red SVG anchor pin (which is what marks the GPS coord).
 *
 * Container is 144×124 with `justify-content: flex-end`, so content stacks
 * from the bottom: name (20) + flex gap (4) + anchor (22) + flex gap (4) +
 * thumb (variable). Anchor tip = bottom of anchor SVG = container_y 100.
 */
export const ICON_ANCHOR_Y = 100;
/** Height of the red SVG anchor pin element. */
export const ANCHOR_HEIGHT = 22;
/** Gap between thumb and anchor (and between anchor and label) in the column. */
export const FLEX_GAP = 4;
/** Visual breathing room added to every collision rect. */
export const LABEL_BUFFER = 8;
/** Horizontal padding inside a label bubble (used to size width from text). */
export const LABEL_PADDING_X = 18;
/** Viewport widths up to this value count as "mobile" for thumb sizing. */
export const MOBILE_BREAKPOINT_PX = 1024;
/** Above this group size we stop ring-spreading; the user must zoom in. */
export const MAX_CLUSTER_SIZE = 10;

// --- Zoom buckets ----------------------------------------------------------

/**
 * Five-bucket zoom class - world → continent → country → state → city.
 * CSS uses these same buckets to scale thumbs and label fonts.
 */
export function zoomBucket(zoom: number): 1 | 2 | 3 | 4 | 5 {
  // Buckets 1–4 render as small circles (compact, no clutter at scale).
  // Bucket 5 (zoom ≥ 16) is the detail view - block / street level. Pins
  // switch to the full floating photo + red anchor, and tight clusters
  // ring-spread their full pins (not circles) since there's room.
  if (zoom < 6) return 1;
  if (zoom < 9) return 2;
  if (zoom < 12) return 3;
  if (zoom < 16) return 4;
  return 5;
}

export function isMobileViewport(viewportWidth: number): boolean {
  return viewportWidth <= MOBILE_BREAKPOINT_PX;
}

/** Max label width (px) - caps the rect width for very long pin names. */
export function labelMaxWidthForZoom(zoom: number, mobile = false): number {
  const bucket = zoomBucket(zoom);
  const desktop = [84, 84, 100, 116, 140] as const;
  const mobileSizes = [84, 84, 100, 140, 140] as const;
  return (mobile ? mobileSizes : desktop)[bucket - 1];
}

/** Rendered label height (px) at the given zoom - used for rect y-extent. */
export function labelHeightForZoom(zoom: number, mobile = false): number {
  const bucket = zoomBucket(zoom);
  const desktop = [16, 16, 17, 18, 20] as const;
  const mobileSizes = [16, 16, 17, 21, 22] as const;
  return (mobile ? mobileSizes : desktop)[bucket - 1];
}

/** Approximate px per ASCII character at the matching font size. */
export function charWidthForZoom(zoom: number, mobile = false): number {
  const bucket = zoomBucket(zoom);
  const desktop = [4.5, 4.5, 5.0, 5.5, 6.0] as const;
  const mobileSizes = [4.5, 4.5, 5.0, 6.0, 6.3] as const;
  return (mobile ? mobileSizes : desktop)[bucket - 1];
}

/** Estimated rendered width of `name` at `zoom`, clamped to the max. */
export function estimateLabelWidth(
  name: string,
  zoom: number,
  mobile = false,
): number {
  const estimated =
    name.length * charWidthForZoom(zoom, mobile) + LABEL_PADDING_X;
  return Math.min(labelMaxWidthForZoom(zoom, mobile), estimated);
}

// --- Cluster sizing --------------------------------------------------------

export interface ClusterSizing {
  /** Visual thumb diameter (px) - used as the radius floor. */
  thumbDia: number;
  /** Threshold (px) below which two markers cluster together. */
  threshold: number;
  /** Desired edge-to-edge gap (px) between neighbouring thumbs on the ring. */
  gap: number;
}

/**
 * Per-zoom small-circle diameter (used by clustered pins), proximity
 * threshold (when singletons should cluster), and ring gap.
 *
 * `thumbDia` is the SMALL-CIRCLE size - clustered pins switch to the
 * classic circular thumb at the lat/lng. Singleton (floating-photo) size
 * comes from this function's bucket-5 `thumbDia`. Threshold is sized to the full pin's
 * VISUAL footprint (photo + anchor + breathing room), so two singletons
 * whose photos would visually touch get clustered into small circles.
 */
export function clusterSizingForZoom(
  zoom: number,
  mobile = false,
): ClusterSizing {
  const bucket = zoomBucket(zoom);
  const desktop: ClusterSizing[] = [
    { thumbDia: 28, threshold: 60, gap: 8 },
    { thumbDia: 38, threshold: 76, gap: 10 },
    { thumbDia: 50, threshold: 100, gap: 12 },
    { thumbDia: 62, threshold: 130, gap: 14 },
    // Bucket 5 (zoom ≥ 16): pins render as full floating photos (72 px
    // thumb) WITH labels (max 140 px wide). Ring chord = thumbDia + gap
    // = 72 + 80 = 152, which is wider than a maxed-out label, so adjacent
    // members' labels don't bleed onto neighboring photos.
    { thumbDia: 72, threshold: 100, gap: 80 },
  ];
  const mobileSizes: ClusterSizing[] = [
    { thumbDia: 42, threshold: 84, gap: 10 },
    { thumbDia: 54, threshold: 108, gap: 12 },
    { thumbDia: 66, threshold: 132, gap: 14 },
    { thumbDia: 80, threshold: 160, gap: 18 },
    // Bucket 5 (zoom ≥ 16): mobile pins use an 88 px full-photo thumb.
    { thumbDia: 88, threshold: 120, gap: 90 },
  ];
  return (mobile ? mobileSizes : desktop)[bucket - 1];
}

/**
 * Radius of the ring of spread-out cluster members. The chord between
 * neighbours just needs to clear the small-circle diameter plus a gap -
 * clustered pins render as small circles, not floating photos, so the
 * ring stays tight and members fan around the original lat/lng.
 */
export function clusterRadius(
  n: number,
  zoom: number,
  sizing: ClusterSizing = clusterSizingForZoom(zoom),
): number {
  if (n < 2) return 0;
  const desiredChord = sizing.thumbDia + sizing.gap;
  return Math.max(sizing.thumbDia, desiredChord / (2 * Math.sin(Math.PI / n)));
}

/**
 * Place `n` points evenly on a circle of `radius` around `centroid`,
 * starting at the top (12 o'clock) and going clockwise. The first
 * position is reserved for the cluster leader.
 */
export function ringPositions(
  centroid: Point2D,
  n: number,
  radius: number,
): Point2D[] {
  if (n <= 0) return [];
  const out: Point2D[] = [];
  for (let k = 0; k < n; k++) {
    const angle = (k / n) * Math.PI * 2 - Math.PI / 2;
    out.push({
      x: centroid.x + radius * Math.cos(angle),
      y: centroid.y + radius * Math.sin(angle),
    });
  }
  return out;
}

export function centroidOf(points: Point2D[]): Point2D {
  if (points.length === 0) return { x: 0, y: 0 };
  let cx = 0;
  let cy = 0;
  for (const p of points) {
    cx += p.x;
    cy += p.y;
  }
  return { x: cx / points.length, y: cy / points.length };
}

// --- Clustering ------------------------------------------------------------

export interface ClusterOptions {
  /** Two points within this many px (Euclidean) join the same cluster. */
  threshold: number;
  /** Groups larger than this are returned as singletons. */
  maxGroupSize?: number;
}

/**
 * Seed-based proximity clustering. For each unassigned point in order,
 * pick it as a seed and gather every other unassigned point within
 * `threshold`. Non-transitive - a chain A→B→C→D doesn't merge into one
 * giant cluster the way BFS would, which previously caused real-world
 * pin layouts (e.g. a county's worth of dots, each 60-100px from its
 * neighbour) to balloon into 20+ member groups that overflowed the
 * MAX_CLUSTER_SIZE cap and got emitted as singletons.
 *
 * Returns an array of groups; each group is a list of indices into
 * `points`. Singletons (1-element groups) are included so callers can
 * iterate every input. Oversized groups (> maxGroupSize) are still
 * emitted as singletons, but with this seed-based approach the cap
 * almost never kicks in for natural geographic data.
 */
export function clusterByProximity(
  points: Point2D[],
  { threshold, maxGroupSize = MAX_CLUSTER_SIZE }: ClusterOptions,
): number[][] {
  const groups: number[][] = [];
  const assigned = new Array<boolean>(points.length).fill(false);

  for (let i = 0; i < points.length; i++) {
    if (assigned[i]) continue;
    const group: number[] = [i];
    assigned[i] = true;

    for (let j = i + 1; j < points.length; j++) {
      if (assigned[j]) continue;
      const dx = points[j].x - points[i].x;
      const dy = points[j].y - points[i].y;
      if (Math.hypot(dx, dy) < threshold) {
        assigned[j] = true;
        group.push(j);
      }
    }

    if (group.length > maxGroupSize) {
      for (const idx of group) groups.push([idx]);
    } else {
      groups.push(group);
    }
  }

  return groups;
}

/**
 * Sort a list of indices alphabetically by the corresponding name. Used
 * to pick a stable cluster leader (group[0]) and to give labels a
 * deterministic placement priority.
 */
export function sortIndicesByName(
  indices: readonly number[],
  names: readonly string[],
): number[] {
  return [...indices].sort((a, b) =>
    (names[a] ?? '').localeCompare(names[b] ?? ''),
  );
}

// --- Label collision -------------------------------------------------------

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return !(a.x2 < b.x1 || a.x1 > b.x2 || a.y2 < b.y1 || a.y1 > b.y2);
}

export interface LabelGeometry {
  zoom: number;
  mobile?: boolean;
}

/**
 * Collision rect for a label rendered below its red anchor pin. The
 * anchor tip sits at `pt` (Leaflet's iconAnchor coordinate), so the
 * label top is `FLEX_GAP` below it - no thumb-height dependency, and
 * leader vs. non-leader members share one layout in the redesign.
 */
export function labelRectBelowAnchor(
  pt: Point2D,
  name: string,
  { zoom, mobile = false }: LabelGeometry,
): Rect {
  const labelW = estimateLabelWidth(name, zoom, mobile);
  const labelH = labelHeightForZoom(zoom, mobile);
  const top = pt.y + FLEX_GAP;
  return {
    x1: pt.x - labelW / 2,
    x2: pt.x + labelW / 2,
    y1: top - LABEL_BUFFER,
    y2: top + labelH + LABEL_BUFFER,
  };
}

// --- Atomic label placement decision --------------------------------------

export interface LabelCandidate {
  rect: Rect;
  name: string;
}

export interface DecideLabelVisibilityInput {
  candidates: readonly LabelCandidate[];
  /**
   * Each entry is the list of candidate indices that belong to one
   * spread-out cluster. Cluster members get all-or-nothing labels.
   * Indices not present in any group are treated as singletons.
   */
  clusterGroups: readonly (readonly number[])[];
}

/**
 * Decide which labels to hide. Two-pass greedy:
 *
 *   1. Each cluster placed atomically (alphabetical by leader name).
 *      All members fit, or none do - a ring with one labelled member
 *      is more confusing than no labels at all.
 *   2. Singletons placed individually (alphabetical), each contending
 *      with what's already on the map.
 *
 * Returns the set of candidate indices whose labels should be hidden.
 */
export function decideHiddenLabels({
  candidates,
  clusterGroups,
}: DecideLabelVisibilityInput): Set<number> {
  const hidden = new Set<number>();
  for (let i = 0; i < candidates.length; i++) hidden.add(i);

  const placed: Rect[] = [];

  const tryPlaceGroup = (indices: readonly number[]): boolean => {
    const groupRects: Rect[] = [];
    for (const idx of indices) {
      const c = candidates[idx];
      if (!c) return false;
      if (groupRects.some((g) => rectsOverlap(c.rect, g))) return false;
      if (placed.some((p) => rectsOverlap(c.rect, p))) return false;
      groupRects.push(c.rect);
    }
    placed.push(...groupRects);
    for (const idx of indices) hidden.delete(idx);
    return true;
  };

  const names = candidates.map((c) => c.name);
  const inAnyCluster = new Set<number>();
  for (const g of clusterGroups) for (const idx of g) inAnyCluster.add(idx);

  // Sort clusters by their first member's name (cluster leader) so
  // placement order is deterministic across reloads.
  const sortedClusters = [...clusterGroups]
    .map((g) => [...g])
    .sort((a, b) =>
      (candidates[a[0]]?.name ?? '').localeCompare(
        candidates[b[0]]?.name ?? '',
      ),
    );

  for (const group of sortedClusters) tryPlaceGroup(group);

  const singletons: number[] = [];
  for (let i = 0; i < candidates.length; i++) {
    if (!inAnyCluster.has(i)) singletons.push(i);
  }
  for (const idx of sortIndicesByName(singletons, names)) {
    tryPlaceGroup([idx]);
  }

  return hidden;
}
