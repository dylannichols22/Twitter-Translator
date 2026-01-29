import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateCost,
  estimateCost,
  CostTracker,
  CLAUDE_PRICING,
} from './cost';

describe('Cost Module', () => {
  describe('calculateCost', () => {
    it('calculates cost based on input and output tokens', () => {
      const cost = calculateCost(1000, 500);
      // Claude Sonnet pricing: $3/1M input, $15/1M output
      const expectedInputCost = (1000 / 1_000_000) * CLAUDE_PRICING.inputPerMillion;
      const expectedOutputCost = (500 / 1_000_000) * CLAUDE_PRICING.outputPerMillion;
      expect(cost).toBeCloseTo(expectedInputCost + expectedOutputCost, 6);
    });

    it('returns 0 for zero tokens', () => {
      expect(calculateCost(0, 0)).toBe(0);
    });

    it('handles large token counts', () => {
      const cost = calculateCost(100000, 50000);
      expect(cost).toBeGreaterThan(0);
    });
  });

  describe('estimateCost', () => {
    it('estimates cost based on character count', () => {
      const text = '今天天气真的很好，适合出去玩！';
      const estimate = estimateCost(text);
      expect(estimate.estimatedCost).toBeGreaterThan(0);
      expect(estimate.estimatedInputTokens).toBeGreaterThan(0);
      expect(estimate.estimatedOutputTokens).toBeGreaterThan(0);
    });

    it('estimates higher cost for longer text', () => {
      const shortText = '你好';
      const longText = '今天天气真的很好，适合出去玩！我们一起去公园散步吧，然后找个地方吃午饭。';

      const shortEstimate = estimateCost(shortText);
      const longEstimate = estimateCost(longText);

      expect(longEstimate.estimatedCost).toBeGreaterThan(shortEstimate.estimatedCost);
    });

    it('returns zero estimate for empty text', () => {
      const estimate = estimateCost('');
      expect(estimate.estimatedCost).toBe(0);
    });
  });

  describe('CostTracker', () => {
    let tracker: CostTracker;

    beforeEach(() => {
      tracker = new CostTracker();
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('records usage entry with timestamp', () => {
      const now = new Date('2024-01-15T10:00:00Z');
      vi.setSystemTime(now);

      tracker.recordUsage(100, 200, 0.01);
      const entries = tracker.getEntries();

      expect(entries).toHaveLength(1);
      expect(entries[0].inputTokens).toBe(100);
      expect(entries[0].outputTokens).toBe(200);
      expect(entries[0].cost).toBe(0.01);
      expect(entries[0].timestamp).toBe(now.toISOString());
    });

    it('calculates this week total (Monday to now)', () => {
      // Set to Wednesday
      vi.setSystemTime(new Date('2024-01-17T10:00:00Z'));

      // Entry from this week (Tuesday)
      tracker.recordUsage(100, 200, 0.01);

      // Manually add entry from last week
      tracker['entries'].push({
        inputTokens: 500,
        outputTokens: 1000,
        cost: 0.05,
        timestamp: '2024-01-10T10:00:00Z', // Last Wednesday
      });

      const weeklyTotal = tracker.getThisWeekTotal();
      expect(weeklyTotal).toBeCloseTo(0.01, 4);
    });

    it('calculates this month total (1st to now)', () => {
      vi.setSystemTime(new Date('2024-01-15T10:00:00Z'));

      // Entry from this month
      tracker.recordUsage(100, 200, 0.01);

      // Manually add entry from last month
      tracker['entries'].push({
        inputTokens: 500,
        outputTokens: 1000,
        cost: 0.05,
        timestamp: '2023-12-15T10:00:00Z',
      });

      const monthlyTotal = tracker.getThisMonthTotal();
      expect(monthlyTotal).toBeCloseTo(0.01, 4);
    });

    it('calculates all time total', () => {
      tracker.recordUsage(100, 200, 0.01);
      tracker.recordUsage(200, 400, 0.02);
      tracker.recordUsage(300, 600, 0.03);

      const allTimeTotal = tracker.getAllTimeTotal();
      expect(allTimeTotal).toBeCloseTo(0.06, 4);
    });

    it('returns zero when no entries', () => {
      expect(tracker.getThisWeekTotal()).toBe(0);
      expect(tracker.getThisMonthTotal()).toBe(0);
      expect(tracker.getAllTimeTotal()).toBe(0);
    });

    it('serializes and deserializes entries', () => {
      tracker.recordUsage(100, 200, 0.01);
      tracker.recordUsage(200, 400, 0.02);

      const serialized = tracker.serialize();
      const newTracker = CostTracker.deserialize(serialized);

      expect(newTracker.getAllTimeTotal()).toBeCloseTo(0.03, 4);
      expect(newTracker.getEntries()).toHaveLength(2);
    });

    it('handles deserialization of empty/invalid data', () => {
      const tracker1 = CostTracker.deserialize('');
      expect(tracker1.getEntries()).toHaveLength(0);

      const tracker2 = CostTracker.deserialize('invalid json');
      expect(tracker2.getEntries()).toHaveLength(0);
    });
  });
});
