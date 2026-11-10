/**
 * WEB-046: Edge cases for catalog rendering.
 * Tests malformed metadata, failed images, duplicate IDs, empty rows, and oversized text.
 */

import { describe, it, expect } from 'vitest';
import { renderContentCard, type SharedVideoItem } from '@ctv/shared/ui/ContentCard';

describe('WEB-046: catalog rendering edge cases', () => {
  describe('malformed metadata', () => {
    it('renders with missing title', () => {
      const video: SharedVideoItem = { id: 'v1' };
      const html = renderContentCard(video);
      expect(html).toContain('content-card');
      expect(html).toContain('data-video-id="v1"');
    });

    it('renders with empty title', () => {
      const video: SharedVideoItem = { id: 'v1', title: '' };
      const html = renderContentCard(video);
      expect(html).toContain('content-card__title');
    });

    it('renders with null poster URLs', () => {
      const video: SharedVideoItem = {
        id: 'v1',
        title: 'Test',
        hdPosterUrl: null,
        sdPosterUrl: null,
        thumbnail: null,
      } as SharedVideoItem;
      const html = renderContentCard(video);
      expect(html).toContain('content-card__poster-fallback');
      expect(html).not.toContain('src="null"');
    });

    it('renders with negative duration', () => {
      const video: SharedVideoItem = { id: 'v1', title: 'Test', duration: -100 };
      const html = renderContentCard(video);
      expect(html).not.toContain('content-card__duration');
    });

    it('renders with zero duration', () => {
      const video: SharedVideoItem = { id: 'v1', title: 'Test', duration: 0 };
      const html = renderContentCard(video);
      expect(html).not.toContain('content-card__duration');
    });

    it('renders with non-numeric duration', () => {
      const video: SharedVideoItem = { id: 'v1', title: 'Test' };
      (video as any).duration = '1h30m';
      const html = renderContentCard(video);
      expect(html).toContain('content-card');
    });

    it('renders with undefined content field', () => {
      const video: SharedVideoItem = { id: 'v1', title: 'Test' };
      const html = renderContentCard(video);
      expect(html).toContain('content-card');
    });
  });

  describe('duplicate video IDs', () => {
    it('renders duplicate IDs without error', () => {
      const video1: SharedVideoItem = { id: 'v1', title: 'First', sdPosterUrl: '/t1.jpg' };
      const video2: SharedVideoItem = { id: 'v1', title: 'Second', sdPosterUrl: '/t2.jpg' };
      const html1 = renderContentCard(video1);
      const html2 = renderContentCard(video2);
      expect(html1).toContain('data-video-id="v1"');
      expect(html2).toContain('data-video-id="v1"');
      expect(html1).toContain('card-v1-img');
      expect(html2).toContain('card-v1-img');
    });
  });

  describe('failed poster images', () => {
    it('poster container includes img and fallback elements', () => {
      const video: SharedVideoItem = {
        id: 'v1',
        title: 'Test',
        sdPosterUrl: 'https://cdn.example.com/poster.jpg',
      };
      const html = renderContentCard(video);
      expect(html).toContain('content-card__poster');
      expect(html).toContain('content-card__poster-img');
      expect(html).toContain('content-card__poster-fallback');
    });

    it('image has loading=lazy attribute', () => {
      const video: SharedVideoItem = {
        id: 'v1',
        title: 'Test',
        sdPosterUrl: 'https://cdn.example.com/poster.jpg',
      };
      const html = renderContentCard(video);
      expect(html).toContain('loading="lazy"');
    });

    it('no poster URL renders fallback only', () => {
      const video: SharedVideoItem = { id: 'v1', title: 'Test' };
      const html = renderContentCard(video);
      expect(html).toContain('content-card__poster-fallback');
      expect(html).not.toContain('content-card__poster-img');
    });
  });

  describe('oversized text', () => {
    it('renders 1000-character title', () => {
      const title = 'T'.repeat(1000);
      const video: SharedVideoItem = { id: 'v1', title };
      const html = renderContentCard(video);
      expect(html).toContain(title);
    });

    it('renders 5000-character description', () => {
      const desc = 'D'.repeat(5000);
      const video: SharedVideoItem = { id: 'v1', title: 'Test', shortDescription: desc };
      const html = renderContentCard(video);
      expect(html).toContain(desc);
    });
  });
});
