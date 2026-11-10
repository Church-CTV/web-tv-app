/**
 * SpatialFocus — TV-style axis-aligned spatial focus selection.
 *
 * Pure helpers used by the global D-pad fallback so that non-home screens
 * (Search, Settings, video) get real 2D remote navigation instead of a
 * linear cycler. The geometry follows the standard Roku/CTV model:
 *
 *   - the candidate is the nearest element whose center lies in the pressed
 *     direction, with a hard preference for alignment on the cross axis
 *     (so "right" moves to the next item in the same row, not diagonally);
 *   - if nothing is strictly in that direction, the key is contained
 *     (returns null) rather than wrapping.
 */

export interface Rect {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export type SpatialDirection = 'up' | 'down' | 'left' | 'right';

/** Center x of a rect. */
export function centerX(r: Rect): number {
  return (r.left + r.right) / 2;
}

/** Center y of a rect. */
export function centerY(r: Rect): number {
  return (r.top + r.bottom) / 2;
}

/**
 * True when the center of `to` lies strictly in `dir` relative to `from`.
 * A tolerance equal to half the smaller extent on the move axis avoids
 * treating a same-row (or same-column) neighbor as "in direction".
 */
export function isInRange(from: Rect, to: Rect, dir: SpatialDirection): boolean {
  if (dir === 'up' || dir === 'down') {
    const sign = dir === 'down' ? 1 : -1;
    const tol = Math.min(from.bottom - from.top, to.bottom - to.top) * 0.5;
    return (centerY(to) - centerY(from)) * sign > tol;
  }
  const sign = dir === 'right' ? 1 : -1;
  const tol = Math.min(from.right - from.left, to.right - to.left) * 0.5;
  return (centerX(to) - centerX(from)) * sign > tol;
}

/** Overlap (0..1 of the smaller extent) between two rects on one axis. */
function axisOverlap(a: { start: number; end: number }, b: { start: number; end: number }): number {
  const o = Math.min(a.end, b.end) - Math.max(a.start, b.start);
  if (o <= 0) return 0;
  const minExtent = Math.min(a.end - a.start, b.end - b.start);
  return minExtent > 0 ? o / minExtent : 0;
}

export interface SpatialPick {
  from: Rect;
  to: Rect;
  dir: SpatialDirection;
}

/**
 * Distance score for a candidate already known to be in the pressed
 * direction. Lower is better. The primary term is travel distance along the
 * move axis; the secondary term is cross-axis misalignment, so a straight
 * ahead move always beats a diagonal one of the same distance.
 */
export function scoreSpatial({ from, to, dir }: SpatialPick): number {
  if (dir === 'up' || dir === 'down') {
    const primary = Math.abs(centerY(to) - centerY(from));
    const cross = Math.abs(centerX(to) - centerX(from));
    const xOverlap = axisOverlap(
      { start: from.left, end: from.right },
      { start: to.left, end: to.right }
    );
    return primary + cross * 3 * (1 - xOverlap);
  }
  const primary = Math.abs(centerX(to) - centerX(from));
  const cross = Math.abs(centerY(to) - centerY(from));
  const yOverlap = axisOverlap(
    { start: from.top, end: from.bottom },
    { start: to.top, end: to.bottom }
  );
  return primary + cross * 3 * (1 - yOverlap);
}

/**
 * Choose the best spatial target from `candidates` (each a candidate rect
 * plus the element it belongs to) given the current rect and direction.
 * Only candidates whose center lies in the pressed direction are considered;
 * the nearest of those (cross-axis alignment preferred) wins. Returns null
 * when nothing is in the pressed direction (contained).
 */
export function bestSpatialPick<T extends { rect: Rect }>(
  from: Rect,
  dir: SpatialDirection,
  candidates: T[]
): T | null {
  let best: T | null = null;
  let bestScore = Infinity;
  for (const c of candidates) {
    if (!isInRange(from, c.rect, dir)) continue;
    const s = scoreSpatial({ from, to: c.rect, dir });
    if (s < bestScore) {
      bestScore = s;
      best = c;
    }
  }
  return best;
}
