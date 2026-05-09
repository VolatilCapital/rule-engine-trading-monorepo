---
title: 'Multi-unit parameters — Phase A: foundation + static templates'
type: 'feature'
created: '2026-05-09'
status: 'done'
baseline_commit: 'e420ef9'
context:
  - '{project-root}/packages/rule-engine-trading/src/'
  - '{project-root}/packages/rule-engine-trading-testkit/src/harness/RuleScenarioHarness.ts'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Six "static" R-based templates (`take-profit`, `take-partial`, `move-sl-to-breakeven`, `lock-in-profit-stop`, `free-trade`, `pattern-based-exit`) hard-code R as the only unit. Strategies often want to express thresholds in `%` of price variation or in absolute price move (FX/CFD pip-style usage). This phase establishes the multi-unit foundation and converts the six templates whose semantic is purely "profit reached from entry".

**Approach:** Introduce a `Measurement = { value, unit }` domain primitive with `Unit ∈ {'R','percent','price'}`. Convert the six templates' R-numeric parameters to `Measurement`. The domain stays pure — templates only declare which semantic field to compare and in which unit, via a domain mapping table. All price arithmetic lives in the testkit harness (the hexagonal adapter), which enriches the context with two new canonical fields per unit: `currentPctFromEntry` and `currentPriceMove` (side-aware, profit-positive). This generalises the pattern already used by `trailing-stop` (`trailingNewSL` / `trailingShouldExecute` pre-computed by the harness). **Trailing-stop and max-drawdown-from-peak are explicitly out of scope and live in Phase B and Phase C.**

## Boundaries & Constraints

**Always:**
- Unit set is exactly `'R' | 'percent' | 'price'`. Domain types use string-literal unions, no enum.
- Templates never compute price arithmetic. They only emit `AtomicCondition` against a context field selected by `unit` via the domain mapping table.
- For `percent` and `price`, the harness must produce **side-aware, profit-positive** values (positive when the trade is winning), matching the existing convention of `currentR`.
- Coupled parameters of one template share the same unit (`trigger`/`lockIn`, `trigger`/`recover`). Validate at factory and throw on mismatch.
- Predefined named instances (`TAKE_PARTIAL_*`, `LOCK_IN_*`, `FREE_TRADE_*`, `PATTERN_EXIT_*`) keep their identifier and semantics; their literals are rewritten as `{ value: X, unit: 'R' }`.
- Breaking API change is accepted (no backward-compat shim, no deprecated aliases).
- `TemplateDefinition.parameters` UI metadata splits each measurement into two flat fields `<name>Value: number` + `<name>Unit: 'R'|'percent'|'price'`. The `create` wrapper reassembles the `Measurement`.
- `Measurement.ts` defines all three semantic field maps (`PROFIT_FIELD`, `PEAK_FIELD`, `DRAWDOWN_FROM_PEAK_FIELD`) up front, even though only `PROFIT_FIELD` is consumed in this phase — the maps are domain knowledge and Phases B/C will plug in without re-touching the domain.

**Ask First:**
- Adding a fourth unit (`pips`, `ticks`, `ATR`...): out of scope here. Treat as a separate spec.
- Renaming the new context fields after they appear in the harness API.

**Never:**
- Computing percent / price formulas inside template factories or via JSON Logic expressions inside emitted conditions.
- Touching `trailing-stop` or `max-drawdown-from-peak` template files in this phase (they belong to B and C).
- Touching `time-based-stop` (uses `elapsedMinutes`), `cancel-pending-on-price-level`, or `partial-close-at-price` (no R param).
- Renaming `currentR`, `peakR`, `drawdownFromPeakR` — these stay as the canonical R-unit fields.
- Changing the harness's `peakR` tracking or adding peak-in-price/percent fields (Phase C's job).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Take-profit in R | `{ threshold: { value: 2, unit: 'R' } }` | Condition fires when `currentR ≥ 2` | N/A |
| Take-profit in % | `{ threshold: { value: 1.5, unit: 'percent' } }` | Condition fires when `currentPctFromEntry ≥ 1.5` | N/A |
| Take-profit in price (LONG) | LONG entry 100, threshold `{ 0.5, 'price' }`, current 100.6 | `currentPriceMove = 0.6 ≥ 0.5` → fires | N/A |
| Take-profit in price (SHORT) | SHORT entry 100, current 99.4, threshold `{ 0.5, 'price' }` | `currentPriceMove = 0.6` (favorable) → fires | N/A |
| Lock-in mismatched units | `{ trigger: {3,'R'}, lockIn: {1,'percent'} }` | Factory throws | `Error("trigger and lockIn must share unit")` |
| Lock-in same-unit-percent | `{ trigger: {2,'percent'}, lockIn: {1,'percent'} }` | Condition on `currentPctFromEntry ≥ 2`, action moves SL to `lockInStopPrice_1pct` (harness pre-fills) | N/A |
| Free-trade in % | `{ trigger: {2,'percent'}, recover: {1,'percent'} }` | Closes 50 % of position (ratio `recover.value/trigger.value × 100`) when `currentPctFromEntry ≥ 2` | N/A |
| Free-trade mismatched units | `{ trigger: {2,'R'}, recover: {1,'percent'} }` | Factory throws | `Error("trigger and recover must share unit")` |
| Pattern-exit minProfit in price | `{ minProfit: {0.3,'price'}, ... }` | Pattern condition AND `currentPriceMove ≥ 0.3` | N/A |
| Invalid unit | `{ threshold: { value: 2, unit: 'pips' } }` | Factory throws | `Error("unit must be one of R | percent | price")` |
| Negative value | `{ threshold: { value: -1, unit: 'R' } }` | Factory throws | `Error("value must be > 0")` (or `≥ 0` for `lockIn`) |

</frozen-after-approval>

## Code Map

- `packages/rule-engine-trading/src/domain/Measurement.ts` -- **NEW.** `Unit` literal type, `Measurement` interface, `assertMeasurement(name, m, opts?)`, semantic-to-context-field maps `PROFIT_FIELD`, `PEAK_FIELD`, `DRAWDOWN_FROM_PEAK_FIELD`. All three maps defined now even if only `PROFIT_FIELD` is consumed by this phase.
- `packages/rule-engine-trading/src/conditions/tradingConditions.ts` -- Refactor `createProfitThresholdCondition`, `createProfitBelowCondition` to take `Measurement` (uses `PROFIT_FIELD[unit]`). **Do not touch** `createPeakRReachedCondition` or `createDrawdownFromPeakCondition` (Phase C).
- `packages/rule-engine-trading/src/templates/takeProfit.ts` -- `thresholdR: number` → `threshold: Measurement`.
- `packages/rule-engine-trading/src/templates/takePartial.ts` -- `thresholdR` → `threshold`. Predefined `TAKE_PARTIAL_*` rewrite literals.
- `packages/rule-engine-trading/src/templates/moveSLToBreakeven.ts` -- `thresholdR` → `threshold`.
- `packages/rule-engine-trading/src/templates/lockInProfitStop.ts` -- `triggerR`, `lockInR` → `trigger`, `lockIn`. Same-unit validation. Action `var` becomes `lockInStopPrice_<value><unitSuffix>` (suffix: `R` for R, `pct` for percent, `price` for price; `value` formatted with `.` replaced by `_`, e.g. `lockInStopPrice_0_5R`, `lockInStopPrice_1pct`). Drop `createLockInProfitStopTemplateWithExplicitPrice` (unused). Predefined `LOCK_IN_*` rewrite literals. Export a `lockInProfitStopParamsMap: WeakMap<RuleTemplate, LockInProfitStopTemplateParams>` (mirror of `trailingStopParamsMap`) so the harness can pre-fill the right `lockInStopPrice_*` keys.
- `packages/rule-engine-trading/src/templates/freeTrade.ts` -- `triggerR`, `rToRecover` → `trigger`, `recover`. Same-unit validation. Close-percentage formula stays `(recover.value / trigger.value) * 100` (unit-agnostic ratio). Predefined `FREE_TRADE_*` rewrite literals.
- `packages/rule-engine-trading/src/templates/patternBasedExit.ts` -- `minProfitR?: number` → `minProfit?: Measurement`. Predefined `PATTERN_EXIT_LONG_BEARISH_PROFITABLE` rewrites literal.
- `packages/rule-engine-trading/src/templates/predefinedTemplates.ts` -- For each touched template (`SL_BREAKEVEN_TEMPLATE`, `LOCK_IN_PROFIT_STOP_TEMPLATE`, `TP_TEMPLATE`, `FREE_TRADE_TEMPLATE`): split every measurement into `<name>Value` + `<name>Unit` flat fields (`type: 'string'` for the unit, with `options: ['R','percent','price']`). Update `create` wrappers to reassemble `Measurement`. **Do not touch** `TRAILING_STOP_TEMPLATE` or `MAX_DRAWDOWN_FROM_PEAK_TEMPLATE`.
- `packages/rule-engine-trading/src/public-api.ts` -- Export `Unit`, `Measurement`, `assertMeasurement`, `PROFIT_FIELD`, `PEAK_FIELD`, `DRAWDOWN_FROM_PEAK_FIELD`, `lockInProfitStopParamsMap`. Remove the dropped `createLockInProfitStopTemplateWithExplicitPrice` export.
- `packages/rule-engine-trading-testkit/src/harness/TestActionExecutor.ts` -- Extend `TradingExecutionContext` (and `TradingContextFacts` in `RuleScenarioHarness.ts`) with `currentPctFromEntry: number` and `currentPriceMove: number` (both side-aware, profit-positive).
- `packages/rule-engine-trading-testkit/src/harness/RuleScenarioHarness.ts` -- In `#buildContext`: also need the trade `side` (track on `openPosition` — already on the broker `Position`). Compute and inject `currentPctFromEntry` and `currentPriceMove`. Generalise `lockInStops` to enumerate registered lock-in rules (via `lockInProfitStopParamsMap`) and pre-fill one `lockInStopPrice_<value><unitSuffix>` per rule, computed in price units side-awarely. **Do not modify the trailing-stop block in this phase.**
- `packages/rule-engine-trading/__tests__/measurement.test.ts` -- **NEW.** Unit tests for `assertMeasurement` (all error cases) and the field maps.
- `packages/rule-engine-trading/__tests__/templates/` -- Six small test files, one per touched template, asserting the emitted `AtomicCondition` field equals the expected `PROFIT_FIELD[unit]` and that mismatched-unit factories throw.
- `packages/rule-engine-trading-testkit/__tests__/multiUnit.profit.scenarios.test.ts` -- **NEW.** End-to-end LONG+SHORT scenarios for `take-profit` in `percent` and `price`, and `lock-in-profit-stop` in `percent`.
- `packages/rule-engine-trading/README.md` -- Add a `Measurement` section. Update the parameter columns for the six touched templates to show the new `Measurement` shape.

## Tasks & Acceptance

**Execution:**
- [ ] `packages/rule-engine-trading/src/domain/Measurement.ts` -- create the domain primitive + three semantic field maps -- single source of truth for unit knowledge
- [ ] `packages/rule-engine-trading/src/conditions/tradingConditions.ts` -- refactor `createProfitThresholdCondition`, `createProfitBelowCondition` to consume `Measurement` -- profit-from-entry conditions become unit-aware
- [ ] `packages/rule-engine-trading/src/templates/takeProfit.ts` -- rewrite param interface and factory using `Measurement` -- enables % and price thresholds
- [ ] `packages/rule-engine-trading/src/templates/takePartial.ts` -- same; rewrite predefined `TAKE_PARTIAL_*` literals -- preserves named-instance API
- [ ] `packages/rule-engine-trading/src/templates/moveSLToBreakeven.ts` -- same -- enables % and price triggers for breakeven move
- [ ] `packages/rule-engine-trading/src/templates/lockInProfitStop.ts` -- rewrite + add `lockInProfitStopParamsMap` + drop unused factory -- harness can pre-fill the correct `lockInStopPrice_*` keys
- [ ] `packages/rule-engine-trading/src/templates/freeTrade.ts` -- rewrite using `trigger`/`recover` (same-unit) -- ratio-based close stays unit-agnostic
- [ ] `packages/rule-engine-trading/src/templates/patternBasedExit.ts` -- `minProfit?` becomes `Measurement` -- consistent with the rest
- [ ] `packages/rule-engine-trading/src/templates/predefinedTemplates.ts` -- split each touched template's parameters into `<name>Value` + `<name>Unit` flat UI params + reassembling `create` wrappers -- preserves form-rendering pipeline
- [ ] `packages/rule-engine-trading/src/public-api.ts` -- export new domain symbols; drop removed symbol -- consumers can import `Unit`/`Measurement`
- [ ] `packages/rule-engine-trading-testkit/src/harness/TestActionExecutor.ts` -- add the two new context fields to the type -- type contract matches runtime
- [ ] `packages/rule-engine-trading-testkit/src/harness/RuleScenarioHarness.ts` -- compute and inject `currentPctFromEntry`, `currentPriceMove`; rewrite `lockInStops` generation -- adapter does all the conversion
- [ ] `packages/rule-engine-trading/__tests__/measurement.test.ts` -- create tests for `assertMeasurement` errors and field-map lookups -- guards the domain primitive
- [ ] `packages/rule-engine-trading/__tests__/templates/*.test.ts` -- one test file per touched template asserting condition emission per unit and same-unit validation -- locks the per-template contract
- [ ] `packages/rule-engine-trading-testkit/__tests__/multiUnit.profit.scenarios.test.ts` -- LONG+SHORT scenarios for take-profit (percent, price) and lock-in (percent) -- proves the adapter pipeline
- [ ] `packages/rule-engine-trading/README.md` -- document `Measurement` and update the six template tables -- keeps the public API doc honest

**Acceptance Criteria:**
- Given any of the six touched templates, when a `Measurement` with `unit: 'percent'` or `unit: 'price'` is provided, then no template source file performs `*`, `/`, `+`, or `-` against price or percent values (only `Measurement.value` access and field-name lookup).
- Given the testkit harness in a LONG scenario with `entry=100`, `currentPrice=101.5`, `initialSL=99`, then `currentR≈0.75`, `currentPctFromEntry=1.5`, `currentPriceMove=1.5`. Same scenario as SHORT (`entry=100`, `currentPrice=98.5`, `initialSL=101`): same three values are positive (0.75, 1.5, 1.5).
- Given a `lock-in-profit-stop` (or `free-trade`) template with mismatched units, when the factory runs, then it throws synchronously with a message naming both parameter names.
- Given `pnpm --filter @volatil/rule-engine-trading test && pnpm --filter @volatil/rule-engine-trading-testkit test`, all tests pass.
- Given `pnpm --filter @volatil/rule-engine-trading build && pnpm --filter @volatil/rule-engine-trading bundle`, both succeed; the bundle re-exports `Unit`, `Measurement`, and the three field maps.
- Trailing-stop tests still pass unchanged (the trailing block of the harness is untouched in this phase).

## Spec Change Log

## Design Notes

**Measurement primitive (illustration, not final code):**
```ts
export type Unit = 'R' | 'percent' | 'price';
export interface Measurement { readonly value: number; readonly unit: Unit; }
export const PROFIT_FIELD: Record<Unit, string> = {
  R: 'currentR', percent: 'currentPctFromEntry', price: 'currentPriceMove',
};
export const PEAK_FIELD: Record<Unit, string> = {
  R: 'peakR', percent: 'peakPctFromEntry', price: 'peakPriceMove',
};
export const DRAWDOWN_FROM_PEAK_FIELD: Record<Unit, string> = {
  R: 'drawdownFromPeakR', percent: 'drawdownFromPeakPct', price: 'drawdownFromPeakPrice',
};
```

**Hexagonal mapping (this phase):**
- *Domain (core)*: `Measurement`, field maps, six static templates, profit conditions. Pure. No arithmetic on prices.
- *Port*: implicit context contract — adds `currentPctFromEntry`, `currentPriceMove` to existing fields.
- *Adapter (infrastructure)*: `RuleScenarioHarness#buildContext` computes the port. Production rule-execution service later implements the same port the same way.

**Side-aware formulas (in adapter only):**
- `sign = side === 'BUY' ? +1 : -1`
- `currentPriceMove = sign × (currentPrice − entryPrice)`
- `currentPctFromEntry = (currentPriceMove / entryPrice) × 100`

**Lock-in stop pre-computation (adapter):** the harness today pre-fills `lockInStopPrice_<R>R` for a fixed list of R values. Replace with: walk `lockInProfitStopParamsMap` for every registered template, compute one `lockInStopPrice_<value><unitSuffix>` price per rule. Per unit:
- `R`: `entryPrice + sign × lockIn.value × |entryPrice − initialSL|` (existing logic, generalised)
- `percent`: `entryPrice × (1 + sign × lockIn.value / 100)`
- `price`: `entryPrice + sign × lockIn.value`

## Verification

**Commands:**
- `pnpm --filter @volatil/rule-engine-trading build` -- expected: tsc exits 0, `dist/public-api.d.ts` exports `Unit` and `Measurement`
- `pnpm --filter @volatil/rule-engine-trading bundle` -- expected: tsup exits 0, `bundle/` updated
- `pnpm --filter @volatil/rule-engine-trading test` -- expected: all unit tests pass, including new per-template-per-unit tests
- `pnpm --filter @volatil/rule-engine-trading-testkit test` -- expected: all integration scenarios pass; existing trailing-stop tests still green
- `grep -nE '(currentPrice|entryPrice).*[+\-*/]' packages/rule-engine-trading/src/templates/ packages/rule-engine-trading/src/conditions/` -- expected: no match (no price arithmetic in domain)
