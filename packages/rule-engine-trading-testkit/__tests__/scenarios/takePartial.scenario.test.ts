import { describe, it, expect } from 'vitest';
import { scenario } from '../../src/dsl/scenario.js';
import { TAKE_PARTIAL_1R_50PCT, ActionType } from '@volatil/rule-engine-trading';

describe('takePartial', () => {
  it('should close 50% of position at +1R', async () => {
    const sc = scenario('51% partial close at 1R')
      .platform({ symbol: 'EURUSD', leverage: 100, balance: 10_000 })
      .openPosition({ side: 'BUY', volume: 0.1, entry: 1.0500, sl: 1.0480 })
      .attachRule(TAKE_PARTIAL_1R_50PCT)
      .priceTo(1.0520)
      .expectActionExecuted(ActionType.PARTIAL_CLOSE);

    await sc.run();

    expect(sc.harness!.executedActions.filter(a => a.actionRef === ActionType.PARTIAL_CLOSE)).toHaveLength(1);
    expect(sc.harness!.positionState!.quantity.toNumber()).toBeCloseTo(0.05);
  });
});
