import { describe, it, expect } from 'vitest';
import { scenario } from '../../src/dsl/scenario.js';
import { createMoveSLToBreakevenTemplate, ActionType } from '@volatil/rule-engine-trading';

describe('moveSLToBreakeven', () => {
  it('should move SL to breakeven at +1R and not retrigger', async () => {
    const sc = scenario('Move SL to breakeven at 1R profit')
      .platform({ symbol: 'EURUSD', leverage: 100, balance: 10_000 })
      .openPosition({ side: 'BUY', volume: 0.1, entry: 1.0500, sl: 1.0480 })
      .attachRule(createMoveSLToBreakevenTemplate({ thresholdR: 1 }))
      .priceTo(1.0510)
      .expectStopLossAt(1.0480)
      .priceTo(1.0520)
      .expectStopLossAt(1.0500)
      .expectActionExecuted(ActionType.MOVE_STOP_LOSS)
      .priceTo(1.0530)
      .expectStopLossAt(1.0500);

    await sc.run();

    // not_executed prevents re-trigger: exactly 1 MOVE_STOP_LOSS
    const moveSLs = sc.harness!.executedActions.filter(a => a.actionRef === ActionType.MOVE_STOP_LOSS);
    expect(moveSLs).toHaveLength(1);
  });
});
