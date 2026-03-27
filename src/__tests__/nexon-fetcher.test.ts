/**
 * Tests for the Nexon Data Center trade fetcher.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
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

    it('should use env var NEXON_API_KEY', () => {
      process.env.NEXON_API_KEY = 'env-key';
      const envFetcher = new NexonFetcher({ apiKey: '' });
      expect(envFetcher.isConfigured).toBe(true);
      delete process.env.NEXON_API_KEY;
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
      const tradeData = new Map([
        [
          1,
          {
            spid: 1,
            avgPrice: 1000,
            minPrice: 900,
            maxPrice: 1100,
            tradeCount: 5,
            date: '20250101',
          },
        ],
      ]);
      const result = fetcher.crossVerify(1, 990, tradeData);

      expect(result.verified).toBe(true);
      expect(result.adjustedConfidence).toBeGreaterThan(0);
    });

    it('should reduce confidence for divergent prices', () => {
      const tradeData = new Map([
        [
          1,
          {
            spid: 1,
            avgPrice: 1000,
            minPrice: 800,
            maxPrice: 1200,
            tradeCount: 5,
            date: '20250101',
          },
        ],
      ]);
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

  describe('data center trade data', () => {
    it('should have fetchDataCenterTradeData method', () => {
      expect(typeof fetcher.fetchDataCenterTradeData).toBe('function');
    });

    it('should return empty array when not configured', async () => {
      const unconfigured = new NexonFetcher({ apiKey: '' });
      const tradeData = await unconfigured.fetchDataCenterTradeData();
      expect(tradeData).toEqual([]);
    });

    it('should attempt to fetch from data center (may fail with test key)', async () => {
      const tradeData = await fetcher.fetchDataCenterTradeData();
      expect(Array.isArray(tradeData)).toBe(true);
      // May or may not have results depending on API availability
    });
  });

  describe('date formatting', () => {
    it('should format date in KST timezone', () => {
      // Create a date that would differ in UTC vs KST
      const dateStr = fetcher['formatDateKst'](new Date('2025-01-15T20:00:00Z'));
      // In KST (UTC+9), this would be Jan 16
      expect(dateStr).toMatch(/^\d{8}$/);
      // The date should be '20250116' in KST
      expect(dateStr).toBe('20250116');
    });
  });
});
