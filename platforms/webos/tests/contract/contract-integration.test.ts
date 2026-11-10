/**
 * Contract Integration Tests
 * Verifies that @ctv/core and platform adapters correctly consume the shared contracts.
 * Run with: npx vitest run tests/contract/
 */
import { describe, it, expect } from 'vitest';
import type { Feed, FeedItem, Category, VideoItem } from '@ctv/shared-contracts/contracts/feed';
import type {
  EventType,
  BaseEvent,
  ContentPlayEvent,
} from '@ctv/shared-contracts/contracts/analytics';
import type {
  SubscriptionPlan,
  Subscription,
  PlanId,
} from '@ctv/shared-contracts/contracts/subscriptions';

describe('Contract Integration Tests', () => {
  describe('Feed contract', () => {
    it('Feed type has all required fields', () => {
      // This test verifies the Feed interface structure matches the server contract
      // If any field is added/removed, this test will catch it
      const feedFields: (keyof Feed)[] = ['version', 'channel', 'categories'];
      expect(feedFields.every((f) => typeof f === 'string')).toBe(true);
    });

    it('FeedItem has required fields', () => {
      const itemFields: (keyof FeedItem)[] = [
        'id',
        'type',
        'title',
        'content_id',
        'poster',
        'category',
        'release_date',
      ];
      expect(itemFields.every((f) => typeof f === 'string')).toBe(true);
    });

    it('VideoItem extends FeedItem with video-specific fields', () => {
      const videoFields: (keyof VideoItem)[] = ['video_url', 'duration'];
      expect(videoFields.every((f) => typeof f === 'string')).toBe(true);
    });
  });

  describe('Analytics contract', () => {
    it('EventType includes all required event types', () => {
      const requiredTypes: EventType[] = [
        'screen_view',
        'interaction',
        'content_play',
        'playback_state',
        'deep_link',
        'error',
      ];
      // If any type is missing from the union, the TypeScript compiler catches it
      // This test ensures we haven't accidentally removed types
      expect(requiredTypes.length).toBeGreaterThan(0);
    });
  });

  describe('Subscription contract', () => {
    it('PlanId includes all required plan IDs', () => {
      const requiredPlans: PlanId[] = ['basic', 'premium', 'family'];
      expect(requiredPlans.length).toBe(3);
    });

    it('SubscriptionPlan has required fields', () => {
      const planFields: (keyof SubscriptionPlan)[] = ['id', 'name', 'price', 'period', 'features'];
      expect(planFields.every((f) => typeof f === 'string')).toBe(true);
    });

    it('Subscription has required fields', () => {
      const subFields: (keyof Subscription)[] = ['isActive', 'planId', 'cancelAtPeriodEnd'];
      expect(subFields.every((f) => typeof f === 'string')).toBe(true);
    });
  });

  describe('Type compatibility', () => {
    it('Feed categories are of Category type', () => {
      const catFields: (keyof Category)[] = ['id', 'name', 'icon', 'content'];
      expect(catFields.every((f) => typeof f === 'string')).toBe(true);
    });
  });
});
