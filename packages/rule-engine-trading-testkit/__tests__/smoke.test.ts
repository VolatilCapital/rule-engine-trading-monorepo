/**
 * @file smoke.test.ts
 * @description Smoke test: validates broker wiring without attaching any rule.
 * Goal: prove that RuleScenarioHarness can open a position and drive the price
 * through priceTo(), and that the harness reflects the updated price.
 */

import { describe, it, expect } from 'vitest';
import { RuleScenarioHarness } from '../src/harness/RuleScenarioHarness.js';

describe('RuleScenarioHarness — smoke test (broker wiring only)', () => {
  it('should reflect the driven price after priceTo()', async () => {
    const harness = new RuleScenarioHarness({
      symbol: 'EURUSD',
      leverage: 100,
      balance: 10_000,
    });

    // Open a BUY position with a stop-loss
    await harness.openPosition({
      side: 'BUY',
      volume: 0.1,
      entry: 1.0500,
      sl: 1.0480,
    });

    // Drive the price upward
    await harness.priceTo(1.0520);

    // Assert: the harness reflects 1.0520 via lastBidAsk
    expect(harness.lastBidAsk.bid).toBe(1.0520);
    expect(harness.lastBidAsk.ask).toBe(1.0520);

    // Sanity: the position is still open (SL not triggered)
    expect(harness.positionState).toBeDefined();
    expect(harness.positionState!.isOpen()).toBe(true);

    // Sanity: no rules were attached, so no actions were executed
    expect(harness.executedActions).toHaveLength(0);
  });
});
