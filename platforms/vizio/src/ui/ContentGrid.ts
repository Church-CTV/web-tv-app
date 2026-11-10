/**
 * Vizio UI — ContentGrid, shared renderer + poster degradation.
 *
 * Delegates rendering/interaction to shared/ui/ContentGrid (untouchable:
 * Vizio depends on it), and adds the L3b broken-poster degradation the webOS
 * reference ships in its local ContentCard: a failing poster <img> is hidden
 * so the branded fallback tile (shared/styles/components.css
 * .content-card__poster-fallback / --error) shows instead of the browser's
 * broken-image icon + alt text.
 */

export * from '@ctv/shared/ui/ContentGrid';
import { initContentGrid as sharedInitContentGrid } from '@ctv/shared/ui/ContentGrid';

/**
 * Hide already-failed posters and arm degradation for in-flight ones.
 * Safe to call repeatedly; each img degrades at most once.
 */
export function attachPosterFallbacks(root: ParentNode): void {
  root.querySelectorAll<HTMLImageElement>('.content-card__poster-img').forEach((img) => {
    if (img.dataset.posterDegraded === '1') return;
    img.dataset.posterDegraded = '1';
    const poster = img.closest('.content-card__poster');
    const degrade = (): void => {
      img.style.display = 'none';
      poster?.classList.add('content-card__poster--error');
    };
    // Errors that fired before this wiring ran never re-fire: catch them via
    // complete+naturalWidth===0 (the standard broken-image signature).
    if (img.complete && img.naturalWidth === 0) {
      degrade();
      return;
    }
    img.addEventListener('error', degrade, { once: true });
  });
}

export function initContentGrid(
  container: HTMLDivElement,
  onVideoSelect?: (videoId: string) => void
): void {
  sharedInitContentGrid(container, onVideoSelect);
  attachPosterFallbacks(container);
}
