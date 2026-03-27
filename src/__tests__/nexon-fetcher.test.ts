/**
 * Tests for the Nexon Data Center trade fetcher.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NexonFetcher } from '@/lib/price-crawl/fetchers/nexon-fetcher';

describe('NexonFetcher', () => {
  let fetcher: NexonFetcher;

  beforeEach(() => {
    fetcher = new NexonFetcher({
      apiKey: 'test-api-key',
      appId: '258842',
      timeoutMs: 5000,
    });
  });

  describe('configuration', () => {
    it('should have correct name', () => {
      expect(fetcher.name).toBe('nexon_trade');
    });

    it('should report configured state', () => {
      expect(fetcher.isConfigured).toBe(true);
    });

    it('should report unconfigured when no API key', () => {
      const unconfigured = new NexonFetcher({ apiKey: '' });
      expect(unconfigured.isConfigured).toBe(false);
    });
  });

  describe('fetch without API', () => {
    it('should return empty result when not configured', async () => {
      const unconfigured = new NexonFetcher({ apiKey: '' });
      const result = await unconfigured.fetch();

      expect(result.fetcher).toBe('nexon_trade');
      expect(result.entries).toHaveLength(0);
      expect(result.successCount).toBe(0);
      expect(result.warnings).toContainEqual(
        expect.stringContaining('NEXON_API_KEY'),
      );
    });
  });

  describe('fetch with API', () => {
    it('should attempt fetch and return results (may fail with test key)', async () => {
      const result = await fetcher.fetch();

      expect(result.fetcher).toBe('nexon_trade');
      expect(Array.isArray(result.entries)).toBe(true);
      expect(typeof result.durationMs).toBe('number');
      // May succeed or fail depending on network/API availability
    });
  });

  describe('cross verification', () => {
    it('should boost confidence for close prices', () => {
      const tradeData = new Map([[1, { spid: 1, avgPrice: 1000, minPrice: 900, maxPrice: 1100, tradeCount: 5, date: '20250101' }]]);
      const result = fetcher.crossVerify(1, 990, tradeData);

      expect(result.verified).toBe(true);
      expect(result.adjustedConfidence).toBeGreaterThan(0);
    });

    it('should reduce confidence for divergent prices', () => {
      const tradeData = new Map([[1, { spid: 1, avgPrice: 1000, minPrice: 800, maxPrice: 1200, tradeCount: 5, date: '20250101' }]]);
      const result = fetcher.crossVerify(1, 2000, tradeData);

      expect(result.verified).toBe(false);
      expect(result.adjustedConfidence).toBeLessThan(0);
    });

    it('should return unverified when no Nexon data exists', () => {
      const tradeData = new Map();
      const result = fetcher.crossVerify(1, 1000, tradeData);

      expect(result.verified).toBe(false);
      expect(result.adjustedConfidence).toBe(0);
    });
  });
});
