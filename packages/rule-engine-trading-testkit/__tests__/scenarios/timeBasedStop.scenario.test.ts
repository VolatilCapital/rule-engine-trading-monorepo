import { describe, it, expect } from 'vitest';
import { scenario } from '../../src/dsl/scenario.js';
import { TestClock } from '../../src/harness/Clock.js';
import { TIME_STOP_30MIN_1R, ActionType } from '@volatil/rule-engine-trading';

describe('timeBasedStop', () => {
  it('should not trigger before maxMinutes elapsed', async () => {
    const clock = new TestClock();
    const sc = scenario('Time-based stop: no trigger under 30 min')
      .platform({ symbol: 'EURUSD', leverage: 100, balance: 10_000, clock })
      .openPosition({ side: 'BUY', volume: 0.1, entry: 1.0500, sl: 1.0480 })
      .attachRule(TIME_STOP_30MIN_1R)
      .advanceTime(20)
      .priceTo(1.0510);

    await sc.run();

    expect(sc.harness!.executedActions.filter(a => a.actionRef === ActionType.PLACE_ORDER)).toHaveLength(0);
    expect(sc.harness!.positionState?.isOpen() ?? false).toBe(true);
  });

  it('should trigger after maxMinutes elapsed when profit below minProfitR', async () => {
    const clock = new TestClock();
    const sc = scenario('Time-based stop: trigger after 30 min below +1R')
      .platform({ symbol: 'EURUSD', leverage: 100, balance: 10_000, clock })
      .openPosition({ side: 'BUY', volume: 0.1, entry: 1.0500, sl: 1.0480 })
      .attachRule(TIME_STOP_30MIN_1R)
      .advanceTime(30)
      .priceTo(1.0510)
      .expectActionExecuted(ActionType.PLACE_ORDER);

    await sc.run();

    expect(sc.harness!.executedActions.filter(a => a.actionRef === ActionType.PLACE_ORDER)).toHaveLength(1);
    expect(sc.harness!.positionState?.isOpen() ?? false).toBe(false);
  });

  it('should not trigger after maxMinutes if profit reaches minProfitR', async () => {
    const clock = new TestClock();
    const sc = scenario('Time-based stop: no trigger if +1R reached at 30 min')
      .platform({ symbol: 'EURUSD', leverage: 100, balance: 10_000, clock })
      .openPosition({ side: 'BUY', volume: 0.1, entry: 1.0500, sl: 1.0480 })
      .attachRule(TIME_STOP_30MIN_1R)
      .advanceTime(30)
      .priceTo(1.0520);

    await sc.run();

    expect(sc.harness!.executedActions.filter(a => a.actionRef === ActionType.PLACE_ORDER)).toHaveLength(0);
    expect(sc.harness!.positionState?.isOpen() ?? false).toBe(true);
  });
});
