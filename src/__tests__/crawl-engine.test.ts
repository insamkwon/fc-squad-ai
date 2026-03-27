/**
 * Tests for the CrawlEngine.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CrawlEngine, resetCrawlEngine } from '@/lib/price-crawl/crawl-engine';
import { PriceCacheStore } from '@/lib/price-crawl/price-cache';

describe('CrawlEngine', () => {
  let engine: CrawlEngine;
  let mockPriceCache: PriceCacheStore;

  beforeEach(() => {
    resetCrawlEngine();
    mockPriceCache = new PriceCacheStore('/tmp/test-crawl-engine');
    engine = new CrawlEngine(
      { enableNexonVerification: false },
      mockPriceCache,
    );
  });

  describe('initial state', () => {
    it('should start in idle state', () => {
      expect(engine.status).toBe('idle');
    });

    it('should allow crawling initially', () => {
      expect(engine.canCrawl()).toBe(true);
    });

    it('should have 3 remaining crawls', () => {
      expect(engine.remainingCrawlsToday).toBe(3);
    });
  });

  describe('player lookup', () => {
    it('should accept a player lookup function', () => {
      const lookup = vi.fn(() => []);
      engine.setPlayerLookup(lookup);
      // No error = success
    });
  });

  describe('manual crawl', () => {
    it('should run a manual crawl and return valid result', async () => {
      // Run with short timeout since we're not mocking HTTP
      const result = await engine.runManualCrawl();

      expect(result).toBeDefined();
      expect(result.crawlId).toBeDefined();
      expect(result.startedAt).toBeDefined();
      expect(result.completedAt).toBeDefined();
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(result.fetcherResults)).toBe(true);
    }, 30000); // 30s timeout for actual HTTP calls
  });

  describe('rate limiting', () => {
    it('should track remaining crawls', () => {
      expect(engine.remainingCrawlsToday).toBe(3);
    });

    it('should report canCrawl correctly after history', () => {
      // Record a successful crawl with a KST-compatible timestamp
      const now = new Date();
      const kstOffset = 9 * 60 * 60 * 1000;
      const kstNow = new Date(now.getTime() + kstOffset);
      const kstDateStr = kstNow.toISOString().split('T')[0];

      mockPriceCache.recordCrawlRun({
        crawlId: 'test_1',
        startedAt: kstNow.toISOString(),
        completedAt: kstNow.toISOString(),
        durationMs: 0,
        fetcherResults: [],
        totalUpdated: 1,
        totalUnchanged: 0,
        success: true,
        summary: 'Test',
      });

      // Create a new engine with the same cache to pick up history
      const newEngine = new CrawlEngine({}, mockPriceCache);
      expect(newEngine.remainingCrawlsToday).toBe(2);
    });
  });

  describe('error handling', () => {
    it('should return valid result even when fetchers fail', async () => {
      const result = await engine.runManualCrawl();

      // Even if fetchers fail, the engine should return a valid result
      expect(result).toBeDefined();
      expect(result.crawlId).toBeDefined();
      expect(result.startedAt).toBeDefined();
      expect(result.completedAt).toBeDefined();
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    }, 30000);
  });
});
