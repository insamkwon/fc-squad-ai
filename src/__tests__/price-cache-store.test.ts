/**
 * Tests for the PriceCacheStore.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PriceCacheStore, resetPriceCacheStore } from '@/lib/price-crawl/price-cache';
import type { PriceEntry } from '@/lib/price-crawl/types';
import { existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

describe('PriceCacheStore', () => {
  let store: PriceCacheStore;
  const cacheDir = '/tmp/test-price-cache';

  beforeEach(() => {
    resetPriceCacheStore();
    // Clean up any persisted files from previous tests
    const cacheFile = join(cacheDir, 'price-cache.json');
    const historyFile = join(cacheDir, 'crawl-history.json');
    if (existsSync(cacheFile)) unlinkSync(cacheFile);
    if (existsSync(historyFile)) unlinkSync(historyFile);
    // Create a temp-based store for isolation
    store = new PriceCacheStore(cacheDir);
  });

  describe('initialization', () => {
    it('should initialize with empty cache', () => {
      expect(store.size).toBe(0);
    });

    it('should handle init being called multiple times', () => {
      store.init();
      store.init();
      expect(store.size).toBe(0);
    });
  });

  describe('price operations', () => {
    it('should store and retrieve a price entry', () => {
      const entry: PriceEntry = {
        spid: 101001101,
        price: 1500000,
        source: 'inven',
        recordedAt: '2025-01-01T06:00:00Z',
        confidence: 0.7,
      };

      store.upsertPrices([entry]);
      expect(store.size).toBe(1);

      const retrieved = store.getPrice(101001101);
      expect(retrieved).toBeDefined();
      expect(retrieved!.price).toBe(1500000);
      expect(retrieved!.source).toBe('inven');
      expect(retrieved!.confidence).toBe(0.7);
    });

    it('should update an existing entry with higher confidence', () => {
      const entry1: PriceEntry = {
        spid: 101001101,
        price: 1500000,
        source: 'inven',
        recordedAt: '2025-01-01T06:00:00Z',
        confidence: 0.5,
      };

      const entry2: PriceEntry = {
        spid: 101001101,
        price: 1600000,
        source: 'nexon_trade',
        recordedAt: '2025-01-01T07:00:00Z',
        confidence: 0.9,
      };

      store.upsertPrices([entry1]);
      const result = store.upsertPrices([entry2]);

      expect(result.updated).toBe(1);
      expect(result.unchanged).toBe(0);

      const retrieved = store.getPrice(101001101);
      expect(retrieved!.price).toBe(1600000);
      expect(retrieved!.source).toBe('nexon_trade');
    });

    it('should not update if new entry has lower confidence', () => {
      const entry1: PriceEntry = {
        spid: 101001101,
        price: 1500000,
        source: 'inven',
        recordedAt: '2025-01-01T06:00:00Z',
        confidence: 0.9,
      };

      const entry2: PriceEntry = {
        spid: 101001101,
        price: 1400000,
        source: 'inven',
        recordedAt: '2025-01-01T07:00:00Z',
        confidence: 0.5,
      };

      store.upsertPrices([entry1]);
      const result = store.upsertPrices([entry2]);

      expect(result.updated).toBe(0);
      expect(result.unchanged).toBe(1);

      const retrieved = store.getPrice(101001101);
      expect(retrieved!.price).toBe(1500000);
    });

    it('should retrieve multiple prices by spid', () => {
      const entries: PriceEntry[] = [
        { spid: 1, price: 100, source: 'seed', recordedAt: '2025-01-01T00:00:00Z', confidence: 1.0 },
        { spid: 2, price: 200, source: 'inven', recordedAt: '2025-01-01T06:00:00Z', confidence: 0.7 },
        { spid: 3, price: 300, source: 'nexon_trade', recordedAt: '2025-01-01T07:00:00Z', confidence: 0.9 },
      ];

      store.upsertPrices(entries);

      const result = store.getPrices([1, 3]);
      expect(result.size).toBe(2);
      expect(result.get(1)?.price).toBe(100);
      expect(result.get(3)?.price).toBe(300);
    });

    it('should get all prices', () => {
      const entries: PriceEntry[] = [
        { spid: 1, price: 100, source: 'seed', recordedAt: '2025-01-01T00:00:00Z', confidence: 1.0 },
        { spid: 2, price: 200, source: 'inven', recordedAt: '2025-01-01T06:00:00Z', confidence: 0.7 },
      ];

      store.upsertPrices(entries);
      const all = store.getAllPrices();

      expect(all.size).toBe(2);
    });

    it('should filter prices by source', () => {
      const entries: PriceEntry[] = [
        { spid: 1, price: 100, source: 'seed', recordedAt: '2025-01-01T00:00:00Z', confidence: 1.0 },
        { spid: 2, price: 200, source: 'inven', recordedAt: '2025-01-01T06:00:00Z', confidence: 0.7 },
        { spid: 3, price: 300, source: 'nexon_trade', recordedAt: '2025-01-01T07:00:00Z', confidence: 0.9 },
      ];

      store.upsertPrices(entries);

      expect(store.getPricesBySource('inven')).toHaveLength(1);
      expect(store.getPricesBySource('seed')).toHaveLength(1);
      expect(store.getPricesBySource('nexon_trade')).toHaveLength(1);
    });

    it('should clear all prices', () => {
      const entries: PriceEntry[] = [
        { spid: 1, price: 100, source: 'seed', recordedAt: '2025-01-01T00:00:00Z', confidence: 1.0 },
        { spid: 2, price: 200, source: 'inven', recordedAt: '2025-01-01T06:00:00Z', confidence: 0.7 },
      ];

      store.upsertPrices(entries);
      expect(store.size).toBe(2);

      store.clear();
      expect(store.size).toBe(0);
    });
  });

  describe('name resolution', () => {
    it('should resolve player names to spids', () => {
      const lookup = (name: string) => {
        if (name === '손흥민') return [{ spid: 101001101, name: '손흥민', seasonName: 'TOTNUCL (24/25)' }];
        return [];
      };

      const nameEntries = [
        { playerName: '손흥민', price: 2000000, source: 'inven' as const, confidence: 0.7 },
      ];

      const result = store.resolveAndUpsert(nameEntries, lookup);

      expect(result.resolved).toBe(1);
      expect(result.unresolved).toBe(0);
      expect(store.size).toBe(1);
      expect(store.getPrice(101001101)?.price).toBe(2000000);
    });

    it('should report unresolved names', () => {
      const lookup = () => [];

      const nameEntries = [
        { playerName: '알수없는선수', price: 500000, source: 'inven' as const, confidence: 0.5 },
      ];

      const result = store.resolveAndUpsert(nameEntries, lookup);

      expect(result.resolved).toBe(0);
      expect(result.unresolved).toBe(1);
      expect(store.size).toBe(0);
    });

    it('should resolve multiple names', () => {
      const lookup = (name: string) => {
        const map: Record<string, number> = {
          '손흥민': 101001101,
          '메시': 201001202,
          '음바페': 301001303,
        };
        const spid = map[name];
        if (spid) return [{ spid, name, seasonName: 'BASE (2024)' }];
        return [];
      };

      const nameEntries = [
        { playerName: '손흥민', price: 2000000, source: 'inven' as const, confidence: 0.7 },
        { playerName: '메시', price: 5000000, source: 'inven' as const, confidence: 0.8 },
        { playerName: '알수없는선수', price: 500000, source: 'inven' as const, confidence: 0.5 },
      ];

      const result = store.resolveAndUpsert(nameEntries, lookup);

      expect(result.resolved).toBe(2);
      expect(result.unresolved).toBe(1);
      expect(store.size).toBe(2);
    });
  });

  describe('snapshot and serialization', () => {
    it('should create a valid snapshot', () => {
      const entries: PriceEntry[] = [
        { spid: 1, price: 100, source: 'seed', recordedAt: '2025-01-01T00:00:00Z', confidence: 1.0 },
        { spid: 2, price: 200, source: 'inven', recordedAt: '2025-01-01T06:00:00Z', confidence: 0.7 },
      ];

      store.upsertPrices(entries);
      const snapshot = store.getSnapshot();

      expect(snapshot.count).toBe(2);
      expect(snapshot.updatedAt).toBeDefined();
      expect(snapshot.sources.seed).toBe(1);
      expect(snapshot.sources.inven).toBe(1);
      expect(snapshot.sources.nexon_trade).toBe(0);
    });

    it('should export and import JSON', () => {
      const entries: PriceEntry[] = [
        { spid: 1, price: 100, source: 'seed', recordedAt: '2025-01-01T00:00:00Z', confidence: 1.0 },
        { spid: 2, price: 200, source: 'inven', recordedAt: '2025-01-01T06:00:00Z', confidence: 0.7 },
      ];

      store.upsertPrices(entries);
      const json = store.exportToJson();

      // Parse to verify it's valid JSON
      const parsed = JSON.parse(json);
      expect(parsed.count).toBe(2);
      expect(parsed.prices).toBeDefined();

      // Create a new store and import
      const newStore = new PriceCacheStore('/tmp/test-price-cache-new');
      newStore.importFromJson(json);
      expect(newStore.size).toBe(2);
      expect(newStore.getPrice(1)?.price).toBe(100);
      expect(newStore.getPrice(2)?.price).toBe(200);
    });
  });

  describe('crawl history', () => {
    it('should record and retrieve crawl runs', () => {
      const result = {
        crawlId: 'crawl_test123',
        startedAt: '2025-01-01T06:00:00Z',
        completedAt: '2025-01-01T06:01:00Z',
        durationMs: 60000,
        fetcherResults: [],
        totalUpdated: 10,
        totalUnchanged: 5,
        success: true,
        summary: 'Crawl completed successfully',
      };

      store.recordCrawlRun(result);

      const latest = store.getLatestRun();
      expect(latest).toBeDefined();
      expect(latest!.crawlId).toBe('crawl_test123');
      expect(latest!.status).toBe('completed');
    });

    it('should return null when no history exists', () => {
      const latest = store.getLatestRun();
      expect(latest).toBeNull();
    });

    it('should limit history to 100 entries', () => {
      // Add 105 entries
      for (let i = 0; i < 105; i++) {
        store.recordCrawlRun({
          crawlId: `crawl_${i}`,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: 0,
          fetcherResults: [],
          totalUpdated: 0,
          totalUnchanged: 0,
          success: true,
          summary: `Crawl ${i}`,
        });
      }

      const history = store.getCrawlHistory(200);
      expect(history.length).toBe(100);
    });
  });

  describe('system status', () => {
    it('should return valid system status', () => {
      const status = store.getSystemStatus(3);

      expect(status.status).toBe('idle');
      expect(status.crawlCountToday).toBe(0);
      expect(status.maxCrawlsPerDay).toBe(3);
      expect(status.nextScheduledCrawl).toBeDefined();
      expect(status.schedule.times).toHaveLength(3);
      expect(status.priceCache).toBeDefined();
      expect(status.priceCache.totalPrices).toBe(0);
    });
  });
});
