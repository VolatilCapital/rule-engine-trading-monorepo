# @volatil/rule-engine-trading

Trading rule definitions — templates, actions, conditions, registry, and schemas for the rule-engine.

## Measurement

Several templates take their thresholds as a `Measurement` so the same rule
can be expressed in R-multiples, percent of price, or absolute price move:

```ts
export type Unit = 'R' | 'percent' | 'price';
export interface Measurement { readonly value: number; readonly unit: Unit; }
```

| Unit | Compares against context field | Example |
|---|---|---|
| `R` | `currentR` | `{ value: 2, unit: 'R' }` |
| `percent` | `currentPctFromEntry` | `{ value: 1.5, unit: 'percent' }` |
| `price` | `currentPriceMove` | `{ value: 0.5, unit: 'price' }` |

The mapping is fixed by `PROFIT_FIELD` in `domain/Measurement.ts`. The
`currentPctFromEntry` and `currentPriceMove` fields are populated **side-awarely
and profit-positive** by the adapter (testkit harness or production context
builder), so a rule does not need to know whether the trade is LONG or SHORT.

Coupled measurements (`trigger`/`lockIn`, `trigger`/`recover`) must share the
same unit; the factory throws synchronously otherwise.

The bundled validator `assertMeasurement(name, m, opts?)` enforces the shape
and a positive value (`opts.allowZero` lifts the floor to `>= 0`).

## Templates

### Trailing Stop

Continuous rule (first `isRecurring: true` template) that dynamically moves the
stop loss as price advances. Both `distance` (the geometric step the SL trails
the price by) and the optional `activation` threshold (profit-from-entry that
must be reached before trailing arms) are `Measurement` values and may use
**independent units** — `distance` is a geometric offset, `activation` is a
profit-from-entry gate.

```ts
import { createTrailingStopTemplate } from '@volatil/rule-engine-trading';

// Trailing 0.5R, activates immediately
const trailing = createTrailingStopTemplate({
  distance: { value: 0.5, unit: 'R' },
});

// Trailing 0.5R, activates only after 1R profit
const trailingAct = createTrailingStopTemplate({
  distance: { value: 0.5, unit: 'R' },
  activation: { value: 1, unit: 'R' },
});

// Trailing 0.5 % of price, no activation
const trailingPct = createTrailingStopTemplate({
  distance: { value: 0.5, unit: 'percent' },
});

// Trailing 0.3 in price, mixed-unit gate (arms once profit reaches 1R)
const trailingMixed = createTrailingStopTemplate({
  distance: { value: 0.3, unit: 'price' },
  activation: { value: 1, unit: 'R' },
});
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `distance` | `Measurement` (`R`, `percent`, `price`) | Yes | Trailing distance from the current price (`value > 0`). |
| `activation` | `Measurement` (`R`, `percent`, `price`) | No | Profit-from-entry threshold that must be reached before trailing arms. Omit to start immediately. Once armed, stays armed permanently (sticky). May use a different unit than `distance`. |

**Behavior:**
- Adapter computes the candidate SL per `distance.unit`:
  - `R`:       `entry + (currentR − distance.value) × riskPerUnit`
  - `percent`: `currentPrice × (1 − sign × distance.value / 100)`
  - `price`:   `currentPrice − sign × distance.value`
  where `sign = +1` for BUY, `−1` for SELL.
- Activation is dispatched on `activation.unit` against the matching `PROFIT_FIELD` (`currentR`, `currentPctFromEntry`, or `currentPriceMove`) and is sticky once met.
- Moves SL only when the candidate is more favorable than the current SL (BUY: higher, SELL: lower). Favorability is unit-agnostic — it depends on the trade direction, not on `distance.unit`.
- Stays `ACTIVE` after each execution (`isRecurring: true`) — re-evaluates on the next tick.
- The `trailingShouldExecute` context field gates execution (1 = fire, 0 = skip).

**Context helpers** (populated by the harness or production context builder):

| Field | Type | Description |
|---|---|---|
| `trailingNewSL` | `number` | Candidate new SL price |
| `trailingShouldExecute` | `0 \| 1` | 1 when activation is met AND candidate SL is favorable |

### Multi-unit templates (Phase A)

The following six templates accept `Measurement` parameters:

| Template | Parameters |
|---|---|
| `take-profit` | `threshold: Measurement` |
| `take-partial` | `threshold: Measurement`, `closePercentage: number`, `partialId?: string` |
| `move-sl-to-breakeven` | `threshold: Measurement` |
| `lock-in-profit-stop` | `trigger: Measurement`, `lockIn: Measurement` (same unit; `lockIn.value < trigger.value`), `ruleId?: string` |
| `free-trade` | `trigger: Measurement`, `recover: Measurement` (same unit; `trigger.value >= recover.value`), `ruleId?: string` |
| `pattern-based-exit` | `positionDirection`, `minProfit?: Measurement`, `closePercentage?`, `patternNames?`, `timeframe?`, `ruleId?` |

Predefined named instances (`TAKE_PARTIAL_*`, `LOCK_IN_*`, `FREE_TRADE_*`,
`PATTERN_EXIT_*`) keep their identifiers; their literals were rewritten as
`{ value: X, unit: 'R' }`.

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
