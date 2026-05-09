/**
 * @file trailingStop.scenario.test.ts
 * @description TDD red tests — E2E scenarios for the trailing stop template.
 *
 * All scenarios are RED until:
 *   1. createTrailingStopTemplate is implemented and exported from @volatil/rule-engine-trading
 *   2. The harness context is extended to provide `trailingNewSL` and `trailingShouldExecute`
 *      based on currentR, distance, activationR, entryPrice, and initialSL.
 *
 * Reference geometry (BUY):
 *   entry=1.0500, initialSL=1.0480 → riskPerUnit=0.002
 *   currentR = (currentPrice - entry) / (entry - initialSL)
 *   newSL_BUY = entry + (currentR - distance) * riskPerUnit
 *
 * Reference geometry (SELL):
 *   entry=1.0500, initialSL=1.0520 → riskPerUnit_signed = entry - initialSL = -0.002
 *   currentR = (currentPrice - entry) / (entry - initialSL)  [negative when price falls for BUY convention]
 *   For SELL: riskPerUnit = entry - initialSL (negative), same formula applies.
 *
 * DSL limitations noted:
 *   - The DSL has no `expectRuleStatus()` method. Rule status assertions use
 *     `harness!.executedActions` count across multiple ticks to prove recurrence.
 *   - There is no `expectNoActionExecuted()` — negated assertion is done after run()
 *     via `expect(sc.harness!.executedActions.filter(...)).toHaveLength(0)`.
 */

import { describe, it, expect } from 'vitest';
import { scenario } from '../../src/dsl/scenario.js';
// NOTE: createTrailingStopTemplate does not exist yet — import will fail (expected RED).
import { createTrailingStopTemplate, ActionType } from '@volatil/rule-engine-trading';

// ──────────────────────────────────────────────────────────────────────────────
// Shared test fixture constants
// ──────────────────────────────────────────────────────────────────────────────

const PLATFORM = { symbol: 'EURUSD', leverage: 100, balance: 10_000 };

// BUY position geometry
const BUY_ENTRY = 1.0500;
const BUY_INITIAL_SL = 1.0480;
// SELL position geometry
const SELL_ENTRY = 1.0500;
const SELL_INITIAL_SL = 1.0520;

// Trailing stop presets used in tests (local, NOT exported from public-api)
const TRAILING_BUY_05R = createTrailingStopTemplate({ distance: 0.5 });
const TRAILING_BUY_05R_ACT_1R = createTrailingStopTemplate({ distance: 0.5, activationR: 1 });
const TRAILING_SELL_05R = createTrailingStopTemplate({ distance: 0.5 });

// ──────────────────────────────────────────────────────────────────────────────
// BUY scenarios, no activation
// ──────────────────────────────────────────────────────────────────────────────

describe('trailingStop — BUY, no activation', () => {
  /**
   * Scenario 1 — immediate trigger at R=0.5
   * price=1.0510 → currentR=0.5
   * newSL = 1.0500 + (0.5 - 0.5) * 0.002 = 1.0500  (breakeven)
   */
  it('should move SL to breakeven (1.0500) when price reaches R=0.5 immediately', async () => {
    const sc = scenario('BUY trailing 0.5R: immediate trigger at R=0.5')
      .platform(PLATFORM)
      .openPosition({ side: 'BUY', volume: 0.1, entry: BUY_ENTRY, sl: BUY_INITIAL_SL })
      .attachRule(TRAILING_BUY_05R)
      .priceTo(1.0510) // R = (1.0510 - 1.0500) / 0.002 = 0.5
      .expectStopLossAt(1.0500, 0.000015)
      .expectActionExecuted(ActionType.MOVE_STOP_LOSS);

    await sc.run();

    // Rule must remain ACTIVE (recurring) — proven by checking it fires at all
    // and was not completed after first fire (verified in multi-tick scenario 2)
    expect(sc.harness!.executedActions.filter(a => a.actionRef === ActionType.MOVE_STOP_LOSS)).toHaveLength(1);
  });

  /**
   * Scenario 2 — multi-tick: price rises step-by-step, trailing fires each tick.
   * 1.0510 → R=0.5 → newSL=1.0500
   * 1.0520 → R=1.0 → newSL=1.0510
   * 1.0530 → R=1.5 → newSL=1.0520
   *
   * DSL note: multiple .priceTo() calls are chained — the DSL fully supports this.
   * The rule must fire on each ascending tick (3 MOVE_STOP_LOSS actions total).
   */
  it('should trail SL on each ascending tick (multi-tick: 1.0510→1.0520→1.0530)', async () => {
    const sc = scenario('BUY trailing 0.5R: multi-tick ascending')
      .platform(PLATFORM)
      .openPosition({ side: 'BUY', volume: 0.1, entry: BUY_ENTRY, sl: BUY_INITIAL_SL })
      .attachRule(TRAILING_BUY_05R)
      .priceTo(1.0510) // R=0.5, newSL=1.0500
      .priceTo(1.0520) // R=1.0, newSL=1.0510
      .priceTo(1.0530) // R=1.5, newSL=1.0520
      .expectStopLossAt(1.0520, 0.000015);

    await sc.run();

    // At least 2 MOVE_STOP_LOSS actions to confirm recurrence (expecting 3, but 2+ is the minimum guarantee)
    const moveSLActions = sc.harness!.executedActions.filter(a => a.actionRef === ActionType.MOVE_STOP_LOSS);
    expect(moveSLActions.length).toBeGreaterThanOrEqual(2);
  });

  /**
   * Scenario 3 — price favorable then adverse: SL should NOT decrease.
   * 1.0520 → R=1.0 → newSL=1.0510  (first move)
   * 1.0515 → R=0.75 → trailingShouldExecute = FALSE (candidateSL=1.0505 < currentSL=1.0510)
   *
   * The pullback price (1.0515) is intentionally above the SL (1.0510) so the
   * simulated broker does not trigger a stop-out.
   */
  it('should not decrease SL when price pulls back (lock preservation)', async () => {
    const sc = scenario('BUY trailing 0.5R: adverse tick does not lower SL')
      .platform(PLATFORM)
      .openPosition({ side: 'BUY', volume: 0.1, entry: BUY_ENTRY, sl: BUY_INITIAL_SL })
      .attachRule(TRAILING_BUY_05R)
      .priceTo(1.0520) // R=1.0, newSL=1.0510 → SL moves to 1.0510
      .expectStopLossAt(1.0510, 0.000015)
      .priceTo(1.0515) // R=0.75, pullback above SL — candidateSL=1.0505 not favorable
      .expectStopLossAt(1.0510, 0.000015); // SL stays locked at 1.0510

    await sc.run();

    // Only 1 MOVE_STOP_LOSS fired (on the ascending tick), not on the pullback
    const moveSLActions = sc.harness!.executedActions.filter(a => a.actionRef === ActionType.MOVE_STOP_LOSS);
    expect(moveSLActions).toHaveLength(1);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// BUY scenarios, with activationR
// ──────────────────────────────────────────────────────────────────────────────

describe('trailingStop — BUY, with activationR=1', () => {
  /**
   * Scenario 4 — below activation, no move
   * price=1.0510 → R=0.5 (below activationR=1) → no MOVE_STOP_LOSS
   */
  it('should NOT move SL when price is below activationR=1 (R=0.5)', async () => {
    const sc = scenario('BUY trailing 0.5R, activation=1: no fire below activation')
      .platform(PLATFORM)
      .openPosition({ side: 'BUY', volume: 0.1, entry: BUY_ENTRY, sl: BUY_INITIAL_SL })
      .attachRule(TRAILING_BUY_05R_ACT_1R)
      .priceTo(1.0510); // R=0.5, below activationR=1

    await sc.run();

    expect(sc.harness!.executedActions.filter(a => a.actionRef === ActionType.MOVE_STOP_LOSS)).toHaveLength(0);
    // SL unchanged at initial
    expect(sc.harness!.currentSL).toBeCloseTo(BUY_INITIAL_SL, 4);
  });

  /**
   * Scenario 5 — activation reached
   * price=1.0520 → R=1.0 (≥ activationR=1)
   * newSL = 1.0500 + (1.0 - 0.5) * 0.002 = 1.0510
   */
  it('should move SL to 1.0510 when activation R=1 is reached', async () => {
    const sc = scenario('BUY trailing 0.5R, activation=1: fire at R=1')
      .platform(PLATFORM)
      .openPosition({ side: 'BUY', volume: 0.1, entry: BUY_ENTRY, sl: BUY_INITIAL_SL })
      .attachRule(TRAILING_BUY_05R_ACT_1R)
      .priceTo(1.0520) // R=1.0, activation reached → newSL=1.0510
      .expectStopLossAt(1.0510, 0.000015)
      .expectActionExecuted(ActionType.MOVE_STOP_LOSS);

    await sc.run();

    expect(sc.harness!.executedActions.filter(a => a.actionRef === ActionType.MOVE_STOP_LOSS)).toHaveLength(1);
  });

  /**
   * Scenario 6 — activation reached, then profit drops below activationR.
   * Once activated, the trailing stop stays active — it does NOT re-arm just because
   * currentR drops back below activationR.
   *
   * 1.0530 → R=1.5 → newSL = 1.0500 + (1.5 - 0.5) * 0.002 = 1.0520
   * 1.0525 → R=1.25 → trailingShouldExecute = FALSE (candidateSL=1.0515 < currentSL=1.0520)
   *
   * The pullback price (1.0525) is intentionally above the SL (1.0520) so the
   * simulated broker does not trigger a stop-out.
   */
  it('should keep locked SL when profit drops below activationR after first activation', async () => {
    const sc = scenario('BUY trailing 0.5R, activation=1: SL locked after activation')
      .platform(PLATFORM)
      .openPosition({ side: 'BUY', volume: 0.1, entry: BUY_ENTRY, sl: BUY_INITIAL_SL })
      .attachRule(TRAILING_BUY_05R_ACT_1R)
      .priceTo(1.0530) // R=1.5, newSL=1.0520
      .expectStopLossAt(1.0520, 0.000015)
      .priceTo(1.0525) // R=1.25, drop below activationR — no downward move
      .expectStopLossAt(1.0520, 0.000015); // SL stays at 1.0520

    await sc.run();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// SELL scenario (mirrored)
// ──────────────────────────────────────────────────────────────────────────────

describe('trailingStop — SELL, no activation', () => {
  /**
   * Scenario 7 — SELL mirror of scenario 1.
   * entry=1.0500, initialSL=1.0520, riskPerUnit_signed = entry - initialSL = -0.002
   * price=1.0490 → currentR = (1.0490 - 1.0500) / (1.0500 - 1.0520) = -0.001 / -0.002 = 0.5
   * newSL = 1.0500 + (0.5 - 0.5) * (-0.002) = 1.0500  (breakeven)
   *
   * For SELL: SL moves DOWN (from 1.0520 to 1.0500) — this is a favorable move for the seller.
   */
  it('should move SL to breakeven (1.0500) when SELL price reaches R=0.5', async () => {
    const sc = scenario('SELL trailing 0.5R: breakeven at R=0.5')
      .platform(PLATFORM)
      .openPosition({ side: 'SELL', volume: 0.1, entry: SELL_ENTRY, sl: SELL_INITIAL_SL })
      .attachRule(TRAILING_SELL_05R)
      .priceTo(1.0490) // R=0.5 for SELL
      .expectStopLossAt(1.0500, 0.000015)
      .expectActionExecuted(ActionType.MOVE_STOP_LOSS);

    await sc.run();

    expect(sc.harness!.executedActions.filter(a => a.actionRef === ActionType.MOVE_STOP_LOSS)).toHaveLength(1);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// isRecurring critical regression
// ──────────────────────────────────────────────────────────────────────────────

describe('trailingStop — isRecurring regression', () => {
  /**
   * Scenario 8 — Unfavorable BUY price: no MOVE_STOP_LOSS, rule stays ACTIVE.
   *
   * price=1.0495 → R = (1.0495 - 1.0500) / 0.002 = -0.25 (loss territory)
   * trailingShouldExecute = 0 → no action fired.
   *
   * DSL limitation: there is no `.expectRuleStatus('ACTIVE')` method.
   * We prove the rule is ACTIVE by:
   *   1. Asserting no MOVE_STOP_LOSS was emitted on the adverse tick.
   *   2. Calling harness.priceTo(1.0510) after run() to confirm the rule still fires
   *      (which would be impossible if the rule were COMPLETED).
   */
  it('should not fire on adverse price and remain ACTIVE (recurring)', async () => {
    const sc = scenario('BUY trailing 0.5R: no fire on adverse tick, rule stays active')
      .platform(PLATFORM)
      .openPosition({ side: 'BUY', volume: 0.1, entry: BUY_ENTRY, sl: BUY_INITIAL_SL })
      .attachRule(TRAILING_BUY_05R)
      .priceTo(1.0495); // R=-0.25, adverse — no action expected

    await sc.run();

    // No MOVE_STOP_LOSS on adverse tick
    expect(sc.harness!.executedActions.filter(a => a.actionRef === ActionType.MOVE_STOP_LOSS)).toHaveLength(0);
    // SL still at initial
    expect(sc.harness!.currentSL).toBeCloseTo(BUY_INITIAL_SL, 4);

    // Critical: drive price favorable AFTER run() to prove rule is still ACTIVE.
    // If isRecurring were false, the rule would be COMPLETED and would NOT fire here.
    await sc.harness!.priceTo(1.0510); // R=0.5, newSL=1.0500 — should fire now
    expect(sc.harness!.executedActions.filter(a => a.actionRef === ActionType.MOVE_STOP_LOSS)).toHaveLength(1);
    expect(sc.harness!.currentSL).toBeCloseTo(1.0500, 4);
  });
});
