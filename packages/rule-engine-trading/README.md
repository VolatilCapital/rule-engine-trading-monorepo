# @volatil/rule-engine-trading

Trading rule definitions — templates, actions, conditions, registry, and schemas for the rule-engine.

## Templates

### Trailing Stop

Continuous rule (first `isRecurring: true` template) that dynamically moves the
stop loss as price advances, maintaining a constant R-distance from the current
price.

```ts
import { createTrailingStopTemplate } from '@volatil/rule-engine-trading';

// Trailing 0.5R, activates immediately
const trailing = createTrailingStopTemplate({ distance: 0.5 });

// Trailing 0.5R, activates only after 1R profit
const trailingAct = createTrailingStopTemplate({ distance: 0.5, activationR: 1 });
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `distance` | `number` | Yes | Trailing distance in R multiples (> 0) |
| `activationR` | `number` | No | Activation threshold in R multiples. Trailing starts immediately if omitted. Once activated, stays activated permanently. |

**Behavior:**
- At each tick, computes a candidate SL at `entry + (currentR - distance) × riskPerUnit`
- Moves SL only when the candidate is more favorable than the current SL (BUY: higher, SELL: lower)
- Stays `ACTIVE` after each execution (`isRecurring: true`) — re-evaluates on the next tick
- The `trailingShouldExecute` context field gates execution (1 = fire, 0 = skip)

**Context helpers** (populated by the harness or production context builder):

| Field | Type | Description |
|---|---|---|
| `trailingNewSL` | `number` | Candidate new SL price |
| `trailingShouldExecute` | `0 \| 1` | 1 when activation is met AND candidate SL is favorable |

### All templates

| ID | Category | Maturity | isRecurring |
|---|---|---|---|
| `move-sl-to-breakeven` | `stop-loss` | `stable` | false |
| `take-partial` | `take-profit` | `stable` | false |
| `take-profit` | `take-profit` | `stable` | false |
| `free-trade` | `risk-management` | `stable` | false |
| `partial-close-at-price` | `take-profit` | `stable` | false |
| `max-drawdown-from-peak` | `risk-management` | `stable` | false |
| `lock-in-profit-stop` | `stop-loss` | `stable` | false |
| `pattern-based-exit` | `exit` | `stable` | false |
| `time-based-stop` | `exit` | `stable` | false |
| `cancel-pending-on-price-level` | `risk-management` | `stable` | false |
| `trailing-stop` | `stop-loss` | `lab` | **true** |

## Build

```bash
pnpm --filter @volatil/rule-engine-trading build   # tsc → dist/
pnpm --filter @volatil/rule-engine-trading bundle  # tsup → bundle/
```
