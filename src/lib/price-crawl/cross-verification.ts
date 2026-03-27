/**
 * Cross-verification service for price data.
 *
 * Compares crawled prices (primarily from Inven community) against
 * Nexon Data Center daily trade data to detect and reconcile discrepancies.
 *
 * Verification workflow:
 * 1. Receive crawled prices (Inven) and Nexon trade data
 * 2. For each spid present in both sources, compute price difference
 * 3. Classify discrepancies by severity (none / minor / moderate / severe)
 * 4. Apply a reconciliation strategy based on the discrepancy level and
 *    the reliability of each source (trade count, confidence scores)
 * 5. Produce a verification report with per-player details and summary stats
 * 6. Update the price cache with reconciled prices and adjusted confidences
 *
 * When Nexon data is unavailable for a given spid, the Inven price is kept
 * as-is (strategy = `no_data`), with no confidence change.
 *
 * The service is stateless — it takes inputs and returns results. Persistence
 * (saving to price cache) is handled by the CrawlEngine.
 */

import type {
  PriceEntry,
  PriceDiscrepancy,
  DiscrepancyLevel,
  ReconciliationStrategy,
  VerificationSummary,
  CrossVerificationConfig,
} from './types';
import { DEFAULT_CROSS_VERIFICATION_CONFIG } from './types';

// ---------------------------------------------------------------------------
// Nexon Trade Data (input from NexonFetcher)
// ---------------------------------------------------------------------------

/**
 * Trade data for a single player from the Nexon Data Center.
 * Provided by the NexonFetcher after parsing API/scraper response.
 */
export interface NexonTradeDatum {
  spid: number;
  /** Daily average trade price */
  avgPrice: number;
  /** Lowest trade price of the day */
  minPrice: number;
  /** Highest trade price of the day */
  maxPrice: number;
  /** Number of trades recorded */
  tradeCount: number;
  /** Trade date string (YYYYMMDD) */
  date: string;
}

// ---------------------------------------------------------------------------
// Cross-Verification Service
// ---------------------------------------------------------------------------

export class CrossVerificationService {
  private readonly config: CrossVerificationConfig;

  constructor(config?: Partial<CrossVerificationConfig>) {
    this.config = { ...DEFAULT_CROSS_VERIFICATION_CONFIG, ...config };
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Run cross-verification on a set of crawled prices against Nexon trade data.
   *
   * @param crawledPrices — Map of spid → PriceEntry (typically Inven source)
   * @param nexonTradeData — Map of spid → NexonTradeDatum from Nexon Data Center
   * @param playerNameMap — Optional map of spid → player name for reporting
   * @returns Array of per-player discrepancies + summary stats
   */
  verify(
    crawledPrices: Map<number, PriceEntry>,
    nexonTradeData: Map<number, NexonTradeDatum>,
    playerNameMap?: Map<number, string>,
  ): { discrepancies: PriceDiscrepancy[]; summary: VerificationSummary } {
    const discrepancies: PriceDiscrepancy[] = [];
    const now = new Date().toISOString();

    let totalChecked = 0;
    let withNexonData = 0;
    let withoutNexonData = 0;
    const byLevel: Record<DiscrepancyLevel, number> = {
      none: 0,
      minor: 0,
      moderate: 0,
      severe: 0,
    };
    const byStrategy: Record<ReconciliationStrategy, number> = {
      confidence_adjust: 0,
      weighted_average: 0,
      nexon_override: 0,
      inven_kept: 0,
      flagged: 0,
      no_data: 0,
      skipped: 0,
    };
    let relativeDiffSum = 0;
    let pricesAdjusted = 0;
    let flaggedForReview = 0;

    for (const [spid, entry] of crawledPrices) {
      // Skip seed-only entries — only verify crawl-sourced prices
      if (entry.source === 'seed') {
        byStrategy.skipped++;
        continue;
      }

      totalChecked++;

      const nexonTrade = nexonTradeData.get(spid);
      const playerName = playerNameMap?.get(spid);

      if (!nexonTrade) {
        // No Nexon data for this player — keep Inven price as-is
        discrepancies.push({
          spid,
          playerName,
          invenPrice: entry.price,
          nexonPrice: 0,
          priceDiff: 0,
          relativeDiff: 0,
          level: 'none',
          strategy: 'no_data',
          reconciledPrice: entry.price,
          originalConfidence: entry.confidence,
          adjustedConfidence: entry.confidence,
          nexonTradeCount: 0,
          verifiedAt: now,
          explanation: 'No Nexon Data Center trade data available — Inven price kept unchanged.',
        });
        withoutNexonData++;
        byStrategy.no_data++;
        byLevel.none++;
        continue;
      }

      withNexonData++;

      // Compute difference
      const priceDiff = Math.abs(entry.price - nexonTrade.avgPrice);
      const relativeDiff = priceDiff / nexonTrade.avgPrice;

      // Classify severity
      const level = this.classifyDiscrepancy(relativeDiff);
      byLevel[level]++;

      // Choose reconciliation strategy
      const strategy = this.chooseStrategy(level, nexonTrade.tradeCount);

      // Compute reconciled price and adjusted confidence
      const { reconciledPrice, adjustedConfidence, explanation } =
        this.reconcile(entry, nexonTrade, relativeDiff, level, strategy);

      relativeDiffSum += relativeDiff;
      byStrategy[strategy]++;

      if (reconciledPrice !== entry.price) pricesAdjusted++;
      if (strategy === 'flagged') flaggedForReview++;

      discrepancies.push({
        spid,
        playerName,
        invenPrice: entry.price,
        nexonPrice: nexonTrade.avgPrice,
        priceDiff,
        relativeDiff,
        level,
        strategy,
        reconciledPrice,
        originalConfidence: entry.confidence,
        adjustedConfidence,
        nexonTradeCount: nexonTrade.tradeCount,
        verifiedAt: now,
        explanation,
      });
    }

    const avgRelativeDiff = withNexonData > 0 ? relativeDiffSum / withNexonData : 0;

    const summary: VerificationSummary = {
      totalChecked,
      withNexonData,
      withoutNexonData,
      byLevel,
      byStrategy,
      avgRelativeDiff,
      pricesAdjusted,
      flaggedForReview,
      verifiedAt: now,
    };

    return { discrepancies, summary };
  }

  /**
   * Apply verification results back to the price cache.
   *
   * Updates prices and confidence scores in-place on the crawledPrices map
   * for entries that were adjusted by reconciliation.
   *
   * @returns Updated entries that should be upserted into the cache
   */
  applyToCache(
    crawledPrices: Map<number, PriceEntry>,
    discrepancies: PriceDiscrepancy[],
  ): PriceEntry[] {
    const updates: PriceEntry[] = [];

    for (const d of discrepancies) {
      if (d.strategy === 'no_data' || d.strategy === 'skipped') continue;

      const entry = crawledPrices.get(d.spid);
      if (!entry) continue;

      // Only apply changes if something actually changed
      if (d.reconciledPrice !== entry.price || d.adjustedConfidence !== entry.confidence) {
        const updated: PriceEntry = {
          ...entry,
          price: d.reconciledPrice,
          confidence: Math.max(0, Math.min(1, d.adjustedConfidence)),
        };
        crawledPrices.set(d.spid, updated);
        updates.push(updated);
      }
    }

    return updates;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Classify the severity of a price discrepancy into 4 tiers:
   * - none: ≤ 10% difference
   * - minor: 10–25% difference
   * - moderate: 25–50% difference
   * - severe: > 50% difference
   */
  private classifyDiscrepancy(relativeDiff: number): DiscrepancyLevel {
    if (relativeDiff <= this.config.minorThreshold) return 'none';
    if (relativeDiff <= this.config.moderateThreshold) return 'minor';
    if (relativeDiff <= this.config.severeThreshold) return 'moderate';
    return 'severe';
  }

  /**
   * Choose the reconciliation strategy based on discrepancy level
   * and the reliability of the Nexon trade data.
   */
  private chooseStrategy(
    level: DiscrepancyLevel,
    nexonTradeCount: number,
  ): ReconciliationStrategy {
    if (nexonTradeCount < this.config.minNexonTradeCount) {
      // Insufficient Nexon trade data — only adjust confidence
      return 'confidence_adjust';
    }

    switch (level) {
      case 'none':
        // Prices match well — boost confidence
        return 'confidence_adjust';

      case 'minor':
        // Small difference — weighted average blend
        return 'weighted_average';

      case 'moderate':
        // Moderate difference — if Nexon has high trade count, trust it more
        return nexonTradeCount >= this.config.highConfidenceTradeCount
          ? 'nexon_override'
          : 'weighted_average';

      case 'severe':
        // Large difference — flag for review unless Nexon data is very reliable
        return nexonTradeCount >= this.config.highConfidenceTradeCount * 2
          ? 'nexon_override'
          : 'flagged';

      default:
        return 'confidence_adjust';
    }
  }

  /**
   * Apply the chosen reconciliation strategy and compute the reconciled price,
   * adjusted confidence, and human-readable explanation.
   */
  private reconcile(
    entry: PriceEntry,
    nexonTrade: NexonTradeDatum,
    relativeDiff: number,
    level: DiscrepancyLevel,
    strategy: ReconciliationStrategy,
  ): {
    reconciledPrice: number;
    adjustedConfidence: number;
    explanation: string;
  } {
    const invenPrice = entry.price;
    const nexonPrice = nexonTrade.avgPrice;
    const tradeCount = nexonTrade.tradeCount;
    const diffPct = (relativeDiff * 100).toFixed(1);

    switch (strategy) {
      case 'confidence_adjust': {
        // Price stays the same; confidence is adjusted up or down
        let confidenceDelta: number;
        let explanation: string;

        if (level === 'none') {
          confidenceDelta = this.config.verifiedConfidenceBoost;
          explanation = `Prices match within ${(this.config.minorThreshold * 100).toFixed(0)}% (Inven: ${invenPrice.toLocaleString()} vs Nexon: ${nexonPrice.toLocaleString()}). Confidence boosted by +${confidenceDelta.toFixed(2)}.`;
        } else if (level === 'minor') {
          confidenceDelta = this.config.moderateConfidenceBoost;
          explanation = `Minor discrepancy of ${diffPct}% (Inven: ${invenPrice.toLocaleString()} vs Nexon: ${nexonPrice.toLocaleString()}). Small confidence boost +${confidenceDelta.toFixed(2)}.`;
        } else if (level === 'moderate') {
          confidenceDelta = -this.config.moderateConfidencePenalty;
          explanation = `Moderate discrepancy of ${diffPct}% (Inven: ${invenPrice.toLocaleString()} vs Nexon: ${nexonPrice.toLocaleString()}). Confidence penalized by ${confidenceDelta.toFixed(2)}. Low Nexon trade count (${tradeCount}) — price kept for now.`;
        } else {
          confidenceDelta = -this.config.severeConfidencePenalty;
          explanation = `Severe discrepancy of ${diffPct}% (Inven: ${invenPrice.toLocaleString()} vs Nexon: ${nexonPrice.toLocaleString()}). Confidence penalized by ${confidenceDelta.toFixed(2)}. Low Nexon trade count (${tradeCount}) — price kept for now.`;
        }

        // Extra boost for high Nexon trade count
        if (tradeCount >= this.config.highConfidenceTradeCount) {
          confidenceDelta += this.config.nexonHighConfidenceBoost * 0.5;
          explanation += ` Nexon has high trade volume (${tradeCount} trades).`;
        }

        return {
          reconciledPrice: invenPrice,
          adjustedConfidence: Math.max(0, Math.min(1, entry.confidence + confidenceDelta)),
          explanation,
        };
      }

      case 'weighted_average': {
        const reconciledPrice = Math.round(
          nexonPrice * this.config.nexonWeight +
          invenPrice * this.config.invenWeight,
        );
        let confidenceDelta: number;
        if (level === 'minor') {
          confidenceDelta = this.config.moderateConfidenceBoost;
        } else {
          // moderate level in weighted_average
          confidenceDelta = 0;
        }

        return {
          reconciledPrice,
          adjustedConfidence: Math.max(0, Math.min(1, entry.confidence + confidenceDelta)),
          explanation: `Weighted average applied (${(this.config.nexonWeight * 100).toFixed(0)}% Nexon + ${(this.config.invenWeight * 100).toFixed(0)}% Inven): ${reconciledPrice.toLocaleString()} (was ${invenPrice.toLocaleString()}). Discrepancy: ${diffPct}%.`,
        };
      }

      case 'nexon_override': {
        const confidenceDelta = this.config.nexonHighConfidenceBoost;
        return {
          reconciledPrice: nexonPrice,
          adjustedConfidence: Math.max(0, Math.min(1, entry.confidence + confidenceDelta)),
          explanation: `Nexon price used (${nexonPrice.toLocaleString()}) overriding Inven price (${invenPrice.toLocaleString()}). Nexon has high trade volume (${tradeCount} trades). Discrepancy: ${diffPct}%.`,
        };
      }

      case 'flagged': {
        // Keep Inven price but heavily penalize confidence
        const confidenceDelta = -this.config.severeConfidencePenalty;
        return {
          reconciledPrice: invenPrice,
          adjustedConfidence: Math.max(0, Math.min(1, entry.confidence + confidenceDelta)),
          explanation: `FLAGGED: Severe discrepancy of ${diffPct}% (Inven: ${invenPrice.toLocaleString()} vs Nexon: ${nexonPrice.toLocaleString()}). Price kept at Inven value but flagged for manual review. Nexon trade count: ${tradeCount}.`,
        };
      }

      default: {
        return {
          reconciledPrice: invenPrice,
          adjustedConfidence: entry.confidence,
          explanation: 'No reconciliation applied.',
        };
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let serviceInstance: CrossVerificationService | null = null;

/**
 * Get the singleton CrossVerificationService instance.
 */
export function getCrossVerificationService(
  config?: Partial<CrossVerificationConfig>,
): CrossVerificationService {
  if (!serviceInstance) {
    serviceInstance = new CrossVerificationService(config);
  }
  return serviceInstance;
}

/**
 * Reset the singleton (useful for testing).
 */
export function resetCrossVerificationService(): void {
  serviceInstance = null;
}
