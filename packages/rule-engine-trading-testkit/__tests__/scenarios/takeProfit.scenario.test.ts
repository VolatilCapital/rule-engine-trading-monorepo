import { describe, it, expect } from 'vitest';
import { scenario } from '../../src/dsl/scenario.js';
import { createTakeProfitTemplate, ActionType } from '@volatil/rule-engine-trading';

describe('takeProfit', () => {
  it('should close position when currentR reaches threshold', async () => {
    const sc = scenario('Close position at +2R')
      .platform({ symbol: 'EURUSD', leverage: 100, balance: 10_000 })
      .openPosition({ side: 'BUY', volume: 0.1, entry: 1.0500, sl: 1.0480 })
      .attachRule(createTakeProfitTemplate({ thresholdR: 2 }))
      .priceTo(1.0540)
      .expectActionExecuted(ActionType.PLACE_ORDER);

    await sc.run();

    expect(sc.harness!.executedActions.filter(a => a.actionRef === ActionType.PLACE_ORDER)).toHaveLength(1);
    expect(sc.harness!.positionState?.isOpen() ?? false).toBe(false);
  });

  it('should not trigger below threshold then close at threshold', async () => {
    const sc = scenario('No trigger below 2R, then close at 2R')
      .platform({ symbol: 'EURUSD', leverage: 100, balance: 10_000 })
      .openPosition({ side: 'BUY', volume: 0.1, entry: 1.0500, sl: 1.0480 })
      .attachRule(createTakeProfitTemplate({ thresholdR: 2 }))
      .priceTo(1.0530)
      .priceTo(1.0540)
      .expectActionExecuted(ActionType.PLACE_ORDER);

    await sc.run();

    expect(sc.harness!.executedActions.filter(a => a.actionRef === ActionType.PLACE_ORDER)).toHaveLength(1);
    expect(sc.harness!.positionState?.isOpen() ?? false).toBe(false);
  });
});
