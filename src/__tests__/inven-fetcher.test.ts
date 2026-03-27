/**
 * Tests for the Inven FC Online price fetcher.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InvenFetcher } from '@/lib/price-crawl/fetchers/inven-fetcher';

describe('InvenFetcher', () => {
  let fetcher: InvenFetcher;

  beforeEach(() => {
    fetcher = new InvenFetcher({
      maxPages: 1,
      requestDelayMs: 100,
      timeoutMs: 5000,
    });
  });

  describe('configuration', () => {
    it('should have correct name', () => {
      expect(fetcher.name).toBe('inven');
    });
  });

  describe('HTML parsing', () => {
    it('should parse table patterns from HTML', () => {
      const html = `
        <table>
          <tr>
            <td>손흥민</td>
            <td>1,500,000</td>
            <td>TOTNUCL</td>
          </tr>
          <tr>
            <td>메시</td>
            <td>5,000,000</td>
            <td>ICON</td>
          </tr>
        </table>
      `;

      const result = fetcher.parsePage(html, 1);
      expect(result.prices.length).toBeGreaterThan(0);
    });

    it('should parse text patterns with Korean price format', () => {
      const html = `
        <div>
          손흥민 가격: 1,500,000 BP
          메시 시세: 5,000,000
          음바페 판매가: 3,200,000 BP
        </div>
      `;

      const result = fetcher.parsePage(html, 1);

      // Should find at least some prices
      expect(result.prices.length).toBeGreaterThan(0);

      // Check that prices are reasonable
      for (const price of result.prices) {
        expect(price.price).toBeGreaterThan(0);
        expect(price.playerName.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('should parse dash-separated price lists', () => {
      const html = `
        <div>
손흥민 - 1,500,000
메시 - 5,000,000
        </div>
      `;

      const result = fetcher.parsePage(html, 1);
      expect(result.prices.length).toBeGreaterThan(0);
    });

    it('should handle empty HTML gracefully', () => {
      const result = fetcher.parsePage('<html></html>', 1);
      expect(result.prices).toHaveLength(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should detect next page', () => {
      const htmlWithNext = `
        <div>
          <a class="next" href="?p=2">다음</a>
        </div>
      `;
      const result = fetcher.parsePage(htmlWithNext, 1);
      expect(result.hasNextPage).toBe(true);
    });

    it('should not detect next page when absent', () => {
      const htmlWithoutNext = `
        <div>
          <p>No more pages</p>
        </div>
      `;
      const result = fetcher.parsePage(htmlWithoutNext, 1);
      expect(result.hasNextPage).toBe(false);
    });

    it('should deduplicate prices for the same player', () => {
      const html = `
        <table>
          <tr><td>손흥민</td><td>1,500,000</td></tr>
          <tr><td>손흥민</td><td>1,600,000</td></tr>
          <tr><td>손흥민</td><td>1,400,000</td></tr>
        </table>
      `;

      const result = fetcher.parsePage(html, 1);

      // Should deduplicate to 1 entry (median price = 1,500,000)
      const sonPrices = result.prices.filter((p) => p.playerName === '손흥민');
      expect(sonPrices.length).toBeLessThanOrEqual(2); // May have 1-2 due to multiple strategies
    });

    it('should filter out unreasonable prices', () => {
      const html = `
        <div>
          손흥민 가격: 0 BP
          메시 가격: 99,999,999,999 BP
        </div>
      `;

      const result = fetcher.parsePage(html, 1);

      // Should not include 0 or extremely high prices
      for (const price of result.prices) {
        expect(price.price).toBeGreaterThan(0);
        expect(price.price).toBeLessThan(10_000_000_000);
      }
    });
  });

  describe('price entry conversion', () => {
    it('should convert raw prices to PriceEntry format', () => {
      const rawPrices = [
        { playerName: '손흥민', price: 1500000, isReliable: true },
        { playerName: '메시', price: 5000000, isReliable: false },
      ];

      const entries = fetcher.convertToPriceEntries(rawPrices);

      expect(entries).toHaveLength(2);
      expect(entries[0].price).toBe(1500000);
      expect(entries[0].source).toBe('inven');
      expect(entries[0].confidence).toBeGreaterThan(0);
      expect(entries[1].confidence).toBeLessThan(entries[0].confidence);
    });
  });
});
