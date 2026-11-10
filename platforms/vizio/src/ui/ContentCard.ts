/**
 * ContentCard — Single video card with poster, title, and progress indicator.
 * Mirrors Roku's ContentCard component.
 */

export interface ContentCardProps {
  videoId: string;
  title: string;
  thumbnail: string;
  progress?: number; // 0-100, percentage watched
  isActive?: boolean; // Currently focused
}

/**
 * Create a ContentCard element.
 * Renders a video thumbnail with title overlay and optional progress bar.
 *
 * L3b: Poster container is structured so a broken poster URL degrades
 * gracefully — a branded fallback element fills the space behind the img,
 * and an addEventListener error handler hides the broken-image icon
 * (no inline onerror to avoid CSP violations on Tizen/Vizio).
 */
export function createContentCard(props: ContentCardProps): HTMLDivElement {
  const card = document.createElement('div');
  card.className = 'content-card';
  card.setAttribute('data-video-id', props.videoId);
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');
  card.setAttribute('aria-label', `Play ${props.title}`);

  // Thumbnail container with graceful-degradation fallback (L3b)
  const thumbnail = document.createElement('div');
  thumbnail.className = 'content-card__thumbnail content-card__poster';

  const fallback = document.createElement('div');
  fallback.className = 'content-card__poster-fallback';
  fallback.setAttribute('aria-hidden', 'true');
  thumbnail.appendChild(fallback);

  const img = document.createElement('img');
  img.className = 'content-card__poster-img';
  img.src = props.thumbnail;
  img.alt = props.title;
  img.loading = 'lazy';
  img.addEventListener('error', () => {
    img.style.display = 'none';
    thumbnail.classList.add('content-card__poster--error');
  });
  thumbnail.appendChild(img);
  card.appendChild(thumbnail);

  // Title overlay
  const title = document.createElement('div');
  title.className = 'content-card__title';
  title.textContent = props.title;
  card.appendChild(title);

  // Progress bar (if video has been partially watched)
  if (props.progress !== undefined && props.progress > 0) {
    const progress = document.createElement('div');
    progress.className = 'content-card__progress';
    progress.style.width = `${props.progress}%`;
    card.appendChild(progress);
  }

  // Focus styling
  if (props.isActive) {
    card.classList.add('content-card--active');
  }

  return card;
}

/**
 * Update an existing ContentCard with new data.
 */
export function updateContentCard(card: HTMLDivElement, props: ContentCardProps): void {
  card.setAttribute('data-video-id', props.videoId);
  card.setAttribute('aria-label', `Play ${props.title}`);
  setFocusState(card, props.isActive ?? false);

  const img = card.querySelector('img') as HTMLImageElement;
  if (img) {
    if (img.getAttribute('src') !== props.thumbnail) {
      img.style.display = '';
      img.parentElement?.classList.remove('content-card__poster--error');
    }
    img.src = props.thumbnail;
    img.alt = props.title;
  }

  const title = card.querySelector('.content-card__title') as HTMLDivElement;
  if (title) {
    title.textContent = props.title;
  }

  // Update progress bar
  const existingProgress = card.querySelector('.content-card__progress') as HTMLDivElement;
  if (props.progress !== undefined && props.progress > 0) {
    if (existingProgress) {
      existingProgress.style.width = `${props.progress}%`;
    } else {
      const progress = document.createElement('div');
      progress.className = 'content-card__progress';
      progress.style.width = `${props.progress}%`;
      card.appendChild(progress);
    }
  } else if (existingProgress) {
    existingProgress.remove();
  }
}

/**
 * Set focus state on a ContentCard.
 */
export function setFocusState(card: HTMLDivElement, isActive: boolean): void {
  if (isActive) {
    card.classList.add('content-card--active');
  } else {
    card.classList.remove('content-card--active');
  }
}

export { renderContentCard } from '@ctv/shared/ui/ContentCard';
export type { SharedVideoItem } from '@ctv/shared/ui/ContentCard';
