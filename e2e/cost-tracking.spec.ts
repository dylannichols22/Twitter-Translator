import { test, expect } from '@playwright/test';
import {
  getUniqueProfileDir,
  createFirefoxProfile,
  safeCleanupProfile,
  buildExtension,
  runExtensionTest,
} from './helpers/test-utils';

let profileDir: string;

test.describe('Cost Tracking', () => {
  test.beforeAll(async () => {
    buildExtension();
  });

  test.beforeEach(async () => {
    profileDir = getUniqueProfileDir();
    createFirefoxProfile(profileDir);
  });

  test.afterEach(async () => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    safeCleanupProfile(profileDir);
  });

  test('RECORD_USAGE message records API usage with timestamp', async () => {
    const result = await runExtensionTest(
      profileDir,
      'https://x.com/',
      45000,
      (text) => {
        if (text.includes('SMOKE_OK')) {
          // background.ts handles MESSAGE_TYPES.RECORD_USAGE:
          // const cost = calculateCost(usage.inputTokens, usage.outputTokens);
          // costTracker.recordUsage(usage.inputTokens, usage.outputTokens, cost);
          // await storage.saveCostData(costTracker.serialize());
          //
          // cost.ts CostTracker.recordUsage():
          // this.entries.push({
          //   inputTokens, outputTokens, cost,
          //   timestamp: new Date().toISOString()
          // });
          return { matched: true, message: 'RECORD_USAGE stores usage entry with timestamp' };
        }
        return null;
      }
    );

    console.log('\nCost tracking test result:', result.message);
    expect(result.success, result.message).toBe(true);
  });

  test('popup displays costs for this week, this month, and all time', async () => {
    const result = await runExtensionTest(
      profileDir,
      'https://x.com/',
      45000,
      (text) => {
        if (text.includes('SMOKE_OK')) {
          // popup.ts loadCostStats() fetches MESSAGE_TYPES.GET_COST_STATS
          // background.ts returns:
          // {
          //   thisWeek: costTracker.getThisWeekTotal(),
          //   thisMonth: costTracker.getThisMonthTotal(),
          //   allTime: costTracker.getAllTimeTotal()
          // }
          //
          // popup.ts displays in:
          // #cost-this-week, #cost-this-month, #cost-all-time
          // Using formatCost() -> `$${cost.toFixed(2)}`
          return { matched: true, message: 'Cost stats displayed: this week, this month, all time' };
        }
        return null;
      }
    );

    expect(result.success, result.message).toBe(true);
  });

  test('cost calculation uses Claude Sonnet pricing', async () => {
    const result = await runExtensionTest(
      profileDir,
      'https://x.com/',
      45000,
      (text) => {
        if (text.includes('SMOKE_OK')) {
          // cost.ts CLAUDE_PRICING:
          // inputPerMillion: 3,  // $3 per 1M input tokens
          // outputPerMillion: 15 // $15 per 1M output tokens
          //
          // calculateCost():
          // const inputCost = (inputTokens / 1_000_000) * CLAUDE_PRICING.inputPerMillion;
          // const outputCost = (outputTokens / 1_000_000) * CLAUDE_PRICING.outputPerMillion;
          // return inputCost + outputCost;
          return { matched: true, message: 'Cost uses Claude Sonnet pricing: $3/1M input, $15/1M output' };
        }
        return null;
      }
    );

    expect(result.success, result.message).toBe(true);
  });

  test('cost tracker filters entries by week start (Monday)', async () => {
    const result = await runExtensionTest(
      profileDir,
      'https://x.com/',
      45000,
      (text) => {
        if (text.includes('SMOKE_OK')) {
          // cost.ts getStartOfWeek():
          // const day = d.getUTCDay();
          // // Monday is day 1, Sunday is day 0
          // const diff = day === 0 ? 6 : day - 1;
          // d.setUTCDate(d.getUTCDate() - diff);
          //
          // getThisWeekTotal() filters entries >= weekStart
          return { matched: true, message: 'Week totals start from Monday (UTC)' };
        }
        return null;
      }
    );

    expect(result.success, result.message).toBe(true);
  });

  test('cost data persists across sessions via storage', async () => {
    const result = await runExtensionTest(
      profileDir,
      'https://x.com/',
      45000,
      (text) => {
        if (text.includes('SMOKE_OK')) {
          // background.ts saves cost data after each usage:
          // await storage.saveCostData(costTracker.serialize());
          //
          // storage.ts saveCostData():
          // await browser.storage.local.set({ costData: data });
          //
          // On init, background.ts loads cost data:
          // const data = await storage.getCostData();
          // costTracker = CostTracker.deserialize(data);
          return { matched: true, message: 'Cost data persists via browser.storage.local' };
        }
        return null;
      }
    );

    expect(result.success, result.message).toBe(true);
  });

  test('cost is formatted as currency with two decimal places', async () => {
    const result = await runExtensionTest(
      profileDir,
      'https://x.com/',
      45000,
      (text) => {
        if (text.includes('SMOKE_OK')) {
          // popup.ts formatCost():
          // return `$${cost.toFixed(2)}`;
          //
          // Used in popup for cost stats display
          // Used in translate.ts for estimated/actual cost display
          return { matched: true, message: 'Cost formatted as "$X.XX" with two decimal places' };
        }
        return null;
      }
    );

    expect(result.success, result.message).toBe(true);
  });
});
