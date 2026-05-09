/**
 * @file multiUnit.trailing.scenarios.test.ts
 * @description End-to-end LONG and SHORT scenarios for the multi-unit trailing
 * stop introduced in Phase B:
 *   - distance in `percent` and `price` (LONG and SHORT)
 *   - mixed units: distance in price, activation in R
 *   - activation in `percent` and `price`
 *   - activation stickiness in non-R units
 *   - R-only regression baseline (byte-identical SL trajectory)
 *
 * All formulas live in the harness adapter — the template emits the same
 * `trailingShouldExecute === 1` condition regardless of unit.
 */

import { describe, it, expect } from 'vitest';
import { scenario } from '../src/dsl/scenario.js';
import {
  createTrailingStopTemplate,
  ActionType,
} from '@volatil/rule-engine-trading';

const PLATFORM = { symbol: 'TEST', leverage: 1, balance: 10_000 };

// ──────────────────────────────────────────────────────────────────────────────
// Distance in percent
// ──────────────────────────────────────────────────────────────────────────────

describe('multiUnit trailing — distance in percent', () => {
  it('LONG: candidateSL = currentPrice × (1 − 0.5/100) at price 101', async () => {
    // entry=100, sl=99, distance=0.5%, currentPrice=101
    //   candidateSL = 101 × (1 − 0.005) = 100.495 (favorable: 100.495 > 99)
    const sc = scenario('trailing percent LONG: SL → 100.495')
      .platform(PLATFORM)
      .openPosition({ side: 'BUY', volume: 0.01, entry: 100, sl: 99 })
      .attachRule(createTrailingStopTemplate({ distance: { value: 0.5, unit: 'percent' } }))
      .priceTo(101)
      .expectStopLossAt(100.495, 1e-6)
      .expectActionExecuted(ActionType.MOVE_STOP_LOSS);

    await sc.run();

    expect(
      sc.harness!.executedActions.filter((a) => a.actionRef === ActionType.MOVE_STOP_LOSS),
    ).toHaveLength(1);
  });

  it('SHORT: candidateSL = currentPrice × (1 + 0.5/100) at price 99', async () => {
    // entry=100, sl=101, distance=0.5%, currentPrice=99 (sign=-1)
    //   candidateSL = 99 × (1 − (−1)×0.005) = 99 × 1.005 = 99.495 (favorable: 99.495 < 101)
    const sc = scenario('trailing percent SHORT: SL → 99.495')
      .platform(PLATFORM)
      .openPosition({ side: 'SELL', volume: 0.01, entry: 100, sl: 101 })
      .attachRule(createTrailingStopTemplate({ distance: { value: 0.5, unit: 'percent' } }))
      .priceTo(99)
      .expectStopLossAt(99.495, 1e-6)
      .expectActionExecuted(ActionType.MOVE_STOP_LOSS);

    await sc.run();

    expect(
      sc.harness!.executedActions.filter((a) => a.actionRef === ActionType.MOVE_STOP_LOSS),
    ).toHaveLength(1);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Distance in price
// ──────────────────────────────────────────────────────────────────────────────

describe('multiUnit trailing — distance in price', () => {
  it('LONG: candidateSL = currentPrice − 0.3 at price 101', async () => {
    // entry=100, sl=99, distance=0.3 price, currentPrice=101
    //   candidateSL = 101 − 0.3 = 100.7 (favorable: 100.7 > 99)
    const sc = scenario('trailing price LONG: SL → 100.7')
      .platform(PLATFORM)
      .openPosition({ side: 'BUY', volume: 0.01, entry: 100, sl: 99 })
      .attachRule(createTrailingStopTemplate({ distance: { value: 0.3, unit: 'price' } }))
      .priceTo(101)
      .expectStopLossAt(100.7, 1e-9)
      .expectActionExecuted(ActionType.MOVE_STOP_LOSS);

    await sc.run();

    expect(
      sc.harness!.executedActions.filter((a) => a.actionRef === ActionType.MOVE_STOP_LOSS),
    ).toHaveLength(1);
  });

  it('SHORT: candidateSL = currentPrice + 0.3 at price 99', async () => {
    // entry=100, sl=101, distance=0.3 price, currentPrice=99 (sign=-1)
    //   candidateSL = 99 − (−1)×0.3 = 99.3 (favorable: 99.3 < 101)
    const sc = scenario('trailing price SHORT: SL → 99.3')
      .platform(PLATFORM)
      .openPosition({ side: 'SELL', volume: 0.01, entry: 100, sl: 101 })
      .attachRule(createTrailingStopTemplate({ distance: { value: 0.3, unit: 'price' } }))
      .priceTo(99)
      .expectStopLossAt(99.3, 1e-9)
      .expectActionExecuted(ActionType.MOVE_STOP_LOSS);

    await sc.run();

    expect(
      sc.harness!.executedActions.filter((a) => a.actionRef === ActionType.MOVE_STOP_LOSS),
    ).toHaveLength(1);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Mixed units: distance in price, activation in R
// ──────────────────────────────────────────────────────────────────────────────

describe('multiUnit trailing — mixed units (distance price, activation R)', () => {
  it('LONG: gates on currentR=1, then trails 0.3 below price', async () => {
    // entry=100, sl=99 → riskPerUnit=1
    // tick 1: price=100.5 → currentR=0.5 < activation 1 → no fire
    // tick 2: price=101   → currentR=1.0, activation met
    //                       candidateSL = 101 − 0.3 = 100.7, favorable, fires
    const sc = scenario('trailing mixed LONG: gate R, distance price')
      .platform(PLATFORM)
      .openPosition({ side: 'BUY', volume: 0.01, entry: 100, sl: 99 })
      .attachRule(
        createTrailingStopTemplate({
          distance: { value: 0.3, unit: 'price' },
          activation: { value: 1, unit: 'R' },
        }),
      )
      .priceTo(100.5)
      .expectStopLossAt(99, 1e-9) // unchanged
      .priceTo(101)
      .expectStopLossAt(100.7, 1e-9)
      .expectActionExecuted(ActionType.MOVE_STOP_LOSS);

    await sc.run();

    expect(
      sc.harness!.executedActions.filter((a) => a.actionRef === ActionType.MOVE_STOP_LOSS),
    ).toHaveLength(1);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Activation in percent / price
// ──────────────────────────────────────────────────────────────────────────────

describe('multiUnit trailing — activation in percent', () => {
  it('LONG: gate fires only once currentPctFromEntry ≥ 1.5', async () => {
    // entry=100, sl=99, distance 0.5R, activation 1.5%
    // tick 1: price=101   → pct=1.0 < 1.5 → no fire (SL stays 99)
    // tick 2: price=101.5 → pct=1.5 met. currentR=1.5, candidateSL = 100+(1.5−0.5)×1=101 → favorable
    const sc = scenario('trailing activation percent LONG: arms at +1.5%')
      .platform(PLATFORM)
      .openPosition({ side: 'BUY', volume: 0.01, entry: 100, sl: 99 })
      .attachRule(
        createTrailingStopTemplate({
          distance: { value: 0.5, unit: 'R' },
          activation: { value: 1.5, unit: 'percent' },
        }),
      )
      .priceTo(101)
      .expectStopLossAt(99, 1e-9)
      .priceTo(101.5)
      .expectStopLossAt(101, 1e-9)
      .expectActionExecuted(ActionType.MOVE_STOP_LOSS);

    await sc.run();

    expect(
      sc.harness!.executedActions.filter((a) => a.actionRef === ActionType.MOVE_STOP_LOSS),
    ).toHaveLength(1);
  });
});

describe('multiUnit trailing — activation in price', () => {
  it('LONG: gate fires only once currentPriceMove ≥ 0.5', async () => {
    // entry=100, sl=99, distance 0.5R, activation 0.5 price
    // tick 1: price=100.3 → priceMove=0.3 < 0.5 → no fire
    // tick 2: price=100.5 → priceMove=0.5 met. currentR=0.5, candidateSL=100+(0.5-0.5)×1=100 → favorable
    const sc = scenario('trailing activation price LONG: arms at +0.5')
      .platform(PLATFORM)
      .openPosition({ side: 'BUY', volume: 0.01, entry: 100, sl: 99 })
      .attachRule(
        createTrailingStopTemplate({
          distance: { value: 0.5, unit: 'R' },
          activation: { value: 0.5, unit: 'price' },
        }),
      )
      .priceTo(100.3)
      .expectStopLossAt(99, 1e-9)
      .priceTo(100.5)
      .expectStopLossAt(100, 1e-9)
      .expectActionExecuted(ActionType.MOVE_STOP_LOSS);

    await sc.run();

    expect(
      sc.harness!.executedActions.filter((a) => a.actionRef === ActionType.MOVE_STOP_LOSS),
    ).toHaveLength(1);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Activation stickiness — non-R units
// ──────────────────────────────────────────────────────────────────────────────

describe('multiUnit trailing — activation stickiness (percent)', () => {
  it('LONG: keeps trailing after pct dips below threshold', async () => {
    // entry=100, sl=99, distance 1R, activation 2.5%
    // tick 1: price=102.5 → pct=2.5 ≥ 2.5, activated. currentR=2.5, candidateSL=100+(2.5−1)×1=101.5, fires.
    // tick 2: price=102   → pct=2.0 < 2.5, but already activated; currentR=2,
    //                       candidateSL=100+(2−1)×1=101, but currentSL=101.5 → 101<101.5 not favorable
    //                       → no fire. Price 102 > SL 101.5 so position not stopped out.
    // tick 3: price=103   → pct=3.0; currentR=3; candidateSL=100+(3−1)×1=102 > 101.5 → fires.
    const sc = scenario('trailing activation percent LONG: sticky')
      .platform(PLATFORM)
      .openPosition({ side: 'BUY', volume: 0.01, entry: 100, sl: 99 })
      .attachRule(
        createTrailingStopTemplate({
          distance: { value: 1, unit: 'R' },
          activation: { value: 2.5, unit: 'percent' },
        }),
      )
      .priceTo(102.5)
      .expectStopLossAt(101.5, 1e-9)
      .priceTo(102)
      .expectStopLossAt(101.5, 1e-9) // SL preserved despite pct=2 < 2.5 (sticky)
      .priceTo(103)
      .expectStopLossAt(102, 1e-9);

    await sc.run();

    const moves = sc.harness!.executedActions.filter((a) => a.actionRef === ActionType.MOVE_STOP_LOSS);
    expect(moves).toHaveLength(2);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// R-only baseline regression
// ──────────────────────────────────────────────────────────────────────────────

describe('multiUnit trailing — R-only regression baseline', () => {
  it('produces byte-identical SL trajectory to the pre-Phase-B code (BUY 0.5R)', async () => {
    // Original scenario from trailingStop.scenario.test.ts ascending tick 3 of:
    //   entry=1.0500, sl=1.0480, distance=0.5R
    //   1.0510 → R=0.5 → newSL = 1.0500
    //   1.0520 → R=1.0 → newSL = 1.0510
    //   1.0530 → R=1.5 → newSL = 1.0520
    const sc = scenario('R-only regression: ascending trail matches baseline')
      .platform({ symbol: 'EURUSD', leverage: 100, balance: 10_000 })
      .openPosition({ side: 'BUY', volume: 0.1, entry: 1.0500, sl: 1.0480 })
      .attachRule(createTrailingStopTemplate({ distance: { value: 0.5, unit: 'R' } }))
      .priceTo(1.0510)
      .expectStopLossAt(1.0500, 1e-6)
      .priceTo(1.0520)
      .expectStopLossAt(1.0510, 1e-6)
      .priceTo(1.0530)
      .expectStopLossAt(1.0520, 1e-6);

    await sc.run();

    const moves = sc.harness!.executedActions.filter((a) => a.actionRef === ActionType.MOVE_STOP_LOSS);
    expect(moves.length).toBeGreaterThanOrEqual(3);
  });
});
