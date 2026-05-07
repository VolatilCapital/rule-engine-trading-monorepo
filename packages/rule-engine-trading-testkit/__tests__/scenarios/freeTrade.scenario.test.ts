import { describe, it, expect } from 'vitest';
import { scenario } from '../../src/dsl/scenario.js';
import { FREE_TRADE_2R, ActionType } from '@volatil/rule-engine-trading';

describe('freeTrade', () => {
  it('should close 50% of position at +2R', async () => {
    const sc = scenario('Free trade 2R: partial close 50% at 2R')
      .platform({ symbol: 'EURUSD', leverage: 100, balance: 10_000 })
      .openPosition({ side: 'BUY', volume: 0.1, entry: 1.0500, sl: 1.0480 })
      .attachRule(FREE_TRADE_2R)
      .priceTo(1.0540)
      .expectActionExecuted(ActionType.PARTIAL_CLOSE);

    await sc.run();

    expect(sc.harness!.executedActions.filter(a => a.actionRef === ActionType.PARTIAL_CLOSE)).toHaveLength(1);
    expect(sc.harness!.positionState!.quantity.toNumber()).toBeCloseTo(0.05);
  });

  it('should not retrigger after first partial close', async () => {
    const sc = scenario('Free trade 2R does not re-fire')
      .platform({ symbol: 'EURUSD', leverage: 100, balance: 10_000 })
      .openPosition({ side: 'BUY', volume: 0.1, entry: 1.0500, sl: 1.0480 })
      .attachRule(FREE_TRADE_2R)
      .priceTo(1.0540)
      .priceTo(1.0560)
      .priceTo(1.0540)
      .expectActionExecuted(ActionType.PARTIAL_CLOSE);

    await sc.run();

    expect(sc.harness!.executedActions.filter(a => a.actionRef === ActionType.PARTIAL_CLOSE)).toHaveLength(1);
    expect(sc.harness!.positionState!.quantity.toNumber()).toBeCloseTo(0.05);
  });
});
