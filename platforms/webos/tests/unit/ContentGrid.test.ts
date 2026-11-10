/**
 * WebOS ContentGrid UI component — unit tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createContentGrid, updateContentGrid, focusFirstCard } from '../../src/ui/ContentGrid';

describe('ContentGrid', () => {
  let grid: HTMLDivElement;
  let selectedVideos: string[];

  const mockCategories = [
    {
      id: 'cat1',
      name: 'Category 1',
      videos: [
        { videoId: 'video-1', title: 'Video 1', thumbnail: 'thumb1.jpg' },
        { videoId: 'video-2', title: 'Video 2', thumbnail: 'thumb2.jpg' },
      ],
    },
    {
      id: 'cat2',
      name: 'Category 2',
      videos: [{ videoId: 'video-3', title: 'Video 3', thumbnail: 'thumb3.jpg' }],
    },
  ];

  beforeEach(() => {
    selectedVideos = [];
    grid = createContentGrid({
      categories: mockCategories,
      onVideoSelect: (videoId) => selectedVideos.push(videoId),
    });
  });

  it('creates a grid with correct class', () => {
    expect(grid.className).toBe('content-grid');
  });

  it('renders category rows', () => {
    const rows = grid.querySelectorAll('.content-grid__row');
    expect(rows).toHaveLength(2);
  });

  it('renders category titles', () => {
    const titles = grid.querySelectorAll('.content-grid__row-title');
    expect(titles).toHaveLength(2);
    expect(titles[0]?.textContent).toBe('Category 1');
    expect(titles[1]?.textContent).toBe('Category 2');
  });

  it('renders video cards', () => {
    const cards = grid.querySelectorAll('.content-card');
    expect(cards).toHaveLength(3);
  });

  it('attaches click handlers to cards', () => {
    const cards = grid.querySelectorAll('.content-card');
    cards[0].dispatchEvent(new MouseEvent('click'));
    expect(selectedVideos).toContain('video-1');
  });

  it('updates grid with new data', () => {
    const newCategories = [
      {
        id: 'cat3',
        name: 'Category 3',
        videos: [
          { videoId: 'video-4', title: 'Video 4', thumbnail: 'thumb4.jpg' },
          { videoId: 'video-5', title: 'Video 5', thumbnail: 'thumb5.jpg' },
        ],
      },
    ];

    updateContentGrid(grid, newCategories, (videoId) => selectedVideos.push(videoId));

    const rows = grid.querySelectorAll('.content-grid__row');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.querySelector('.content-grid__row-title')?.textContent).toBe('Category 3');
  });

  it('focuses first card', () => {
    const cards = grid.querySelectorAll('.content-card');
    // Mock focus() to work in jsdom
    const focusSpy = vi.spyOn(cards[0], 'focus').mockImplementation(() => {});
    focusFirstCard(grid);
    expect(focusSpy).toHaveBeenCalled();
    focusSpy.mockRestore();
  });

  it('does nothing if no cards exist', () => {
    const emptyGrid = createContentGrid({
      categories: [],
      onVideoSelect: () => {},
    });
    expect(() => focusFirstCard(emptyGrid)).not.toThrow();
  });
});
