// Claude Haiku 4.5 pricing (as of 2025)
export const CLAUDE_PRICING = {
  inputPerMillion: 1, // $1 per 1M input tokens
  outputPerMillion: 5, // $5 per 1M output tokens
};

// Rough estimate: Chinese characters tend to be ~1.5-2 tokens each
const CHARS_PER_TOKEN = 0.6;
// Output is typically 3-4x input for translation + segmentation + notes
const OUTPUT_MULTIPLIER = 3.5;

export interface UsageEntry {
  inputTokens: number;
  outputTokens: number;
  cost: number;
  timestamp: string;
}

export interface CostEstimate {
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCost: number;
}

export function calculateCost(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1_000_000) * CLAUDE_PRICING.inputPerMillion;
  const outputCost = (outputTokens / 1_000_000) * CLAUDE_PRICING.outputPerMillion;
  return inputCost + outputCost;
}

export function estimateCost(text: string): CostEstimate {
  if (!text) {
    return {
      estimatedInputTokens: 0,
      estimatedOutputTokens: 0,
      estimatedCost: 0,
    };
  }

  // Estimate tokens from character count
  const estimatedInputTokens = Math.ceil(text.length / CHARS_PER_TOKEN);
  const estimatedOutputTokens = Math.ceil(estimatedInputTokens * OUTPUT_MULTIPLIER);
  const estimatedCost = calculateCost(estimatedInputTokens, estimatedOutputTokens);

  return {
    estimatedInputTokens,
    estimatedOutputTokens,
    estimatedCost,
  };
}

function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  // Monday is day 1, Sunday is day 0
  const diff = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function getStartOfMonth(date: Date): Date {
  const d = new Date(date);
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function getStartOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export class CostTracker {
  private entries: UsageEntry[] = [];

  recordUsage(inputTokens: number, outputTokens: number, cost: number): void {
    this.entries.push({
      inputTokens,
      outputTokens,
      cost,
      timestamp: new Date().toISOString(),
    });
  }

  getEntries(): UsageEntry[] {
    return [...this.entries];
  }

  getThisWeekTotal(): number {
    const now = new Date();
    const weekStart = getStartOfWeek(now);

    return this.entries
      .filter((entry) => new Date(entry.timestamp) >= weekStart)
      .reduce((sum, entry) => sum + entry.cost, 0);
  }

  getThisMonthTotal(): number {
    const now = new Date();
    const monthStart = getStartOfMonth(now);

    return this.entries
      .filter((entry) => new Date(entry.timestamp) >= monthStart)
      .reduce((sum, entry) => sum + entry.cost, 0);
  }

  getAllTimeTotal(): number {
    return this.entries.reduce((sum, entry) => sum + entry.cost, 0);
  }

  getTodayUsage(): { inputTokens: number; outputTokens: number; cost: number; count: number } {
    const now = new Date();
    const dayStart = getStartOfDay(now);

    return this.entries
      .filter((entry) => new Date(entry.timestamp) >= dayStart)
      .reduce(
        (acc, entry) => {
          acc.inputTokens += entry.inputTokens;
          acc.outputTokens += entry.outputTokens;
          acc.cost += entry.cost;
          acc.count += 1;
          return acc;
        },
        { inputTokens: 0, outputTokens: 0, cost: 0, count: 0 }
      );
  }

  serialize(): string {
    return JSON.stringify(this.entries);
  }

  static deserialize(data: string): CostTracker {
    const tracker = new CostTracker();
    if (!data) return tracker;

    try {
      const entries = JSON.parse(data);
      if (Array.isArray(entries)) {
        tracker.entries = entries;
      }
    } catch {
      // Invalid JSON, return empty tracker
    }

    return tracker;
  }
}
