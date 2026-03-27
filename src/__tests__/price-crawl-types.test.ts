/**
 * Tests for price crawl type definitions and constants.
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_INVEN_CONFIG,
  DEFAULT_NEXON_CONFIG,
  DEFAULT_CRAWL_CONFIG,
  CRAWL_SCHEDULE_KST,
  CRAWL_CRON_UTC,
} from '@/lib/price-crawl/types';

describe('price-crawl types', () => {
  describe('default configurations', () => {
    it('should have valid Inven fetcher config', () => {
      expect(DEFAULT_INVEN_CONFIG.baseUrl).toContain('inven.co.kr');
      expect(DEFAULT_INVEN_CONFIG.requestDelayMs).toBeGreaterThan(0);
      expect(DEFAULT_INVEN_CONFIG.maxPages).toBeGreaterThan(0);
      expect(DEFAULT_INVEN_CONFIG.timeoutMs).toBeGreaterThan(0);
    });

    it('should have valid Nexon fetcher config', () => {
      expect(DEFAULT_NEXON_CONFIG.appId).toBe('258842');
      expect(DEFAULT_NEXON_CONFIG.timeoutMs).toBeGreaterThan(0);
    });

    it('should have valid crawl engine config', () => {
      expect(DEFAULT_CRAWL_CONFIG.maxCrawlsPerDay).toBe(3);
      expect(DEFAULT_CRAWL_CONFIG.maxConcurrentFetchers).toBeGreaterThan(0);
      expect(DEFAULT_CRAWL_CONFIG.enableNexonVerification).toBe(true);
      expect(DEFAULT_CRAWL_CONFIG.minConfidence).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_CRAWL_CONFIG.minConfidence).toBeLessThanOrEqual(1);
      expect(DEFAULT_CRAWL_CONFIG.maxPriceAgeHours).toBeGreaterThan(0);
    });
  });

  describe('crawl schedule', () => {
    it('should have 3 daily crawl times', () => {
      expect(CRAWL_SCHEDULE_KST).toHaveLength(3);
    });

    it('should have correct KST times', () => {
      expect(CRAWL_SCHEDULE_KST).toContain('06:00');
      expect(CRAWL_SCHEDULE_KST).toContain('14:00');
      expect(CRAWL_SCHEDULE_KST).toContain('22:00');
    });

    it('should have a valid cron expression', () => {
      // Cron: minute hour day-of-month month day-of-week
      const parts = CRAWL_CRON_UTC.split(' ');
      expect(parts).toHaveLength(5);
      // Minute should be 0
      expect(parts[0]).toBe('0');
      // Hour should have 3 values (3x daily)
      expect(parts[1].split(',')).toHaveLength(3);
    });
  });
});
