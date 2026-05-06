import { describe, it, expect } from 'vitest';
import { scenario } from '../../src/dsl/scenario.js';
import { MAX_DD_2R_PEAK_1R_DD, ActionType } from '@volatil/rule-engine-trading';

describe('maxDrawdownFromPeak', () => {
  it('should close position when drawdown from peak exceeds threshold', async () => {
    const sc = scenario('Close on 1R drawdown from 2R peak')
      .platform({ symbol: 'EURUSD', leverage: 100, balance: 10_000 })
      .openPosition({ side: 'BUY', volume: 0.1, entry: 1.0500, sl: 1.0480 })
      .attachRule(MAX_DD_2R_PEAK_1R_DD)
      .priceTo(1.0540) // +2R peak, drawdown 0 → no trigger
      .priceTo(1.0530) // drawdown 0.5R → still below threshold
      .priceTo(1.0520) // drawdown 1R → triggers close
      .expectActionExecuted(ActionType.PLACE_ORDER);

    await sc.run();

    // Exactly 1 close triggered — the first two ticks should NOT have fired
    expect(sc.harness!.executedActions.filter(a => a.actionRef === ActionType.PLACE_ORDER)).toHaveLength(1);
    // Position should be closed
    expect(sc.harness!.positionState?.isOpen() ?? false).toBe(false);
  });
});
