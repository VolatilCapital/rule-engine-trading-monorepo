---
title: 'Multi-unit parameters — Phase B: trailing-stop'
type: 'feature'
created: '2026-05-09'
status: 'in-progress'
baseline_commit: '2ee9968'
context:
  - '{project-root}/packages/rule-engine-trading/src/templates/trailingStop.ts'
  - '{project-root}/packages/rule-engine-trading/src/domain/Measurement.ts'
  - '{project-root}/packages/rule-engine-trading-testkit/src/harness/RuleScenarioHarness.ts'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-multi-unit-rule-parameters.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Phase A made the six "static" templates multi-unit, but `trailing-stop` still hard-codes R for both its `distance` (geometric step trailing the price) and its `activationR` (profit-from-entry threshold). Strategies that want to trail in pips (price units) or in percent of price cannot use this template.

**Approach:** Convert `distance` and `activation` to `Measurement`, allowing them to use **independent** units (`distance` is geometric, `activation` is profit-from-entry). The hexagonal split established in Phase A is preserved: the template still emits a single `AtomicCondition` on `trailingShouldExecute`, and the testkit harness (the adapter) does all the unit-aware math — both the `candidateSL` formula and the activation gating against the appropriate `PROFIT_FIELD[unit]`.

## Boundaries & Constraints

**Always:**
- Reuse the Phase A primitives: `Measurement`, `assertMeasurement`, `Unit`, `PROFIT_FIELD`. Do not redefine them.
- `distance` and `activation` may use different units (independent measurements).
- The harness keeps producing `trailingNewSL` (a price) and `trailingShouldExecute` (`0|1`) — the template's emitted condition does not change shape.
- Activation is stateful (existing behaviour): once met, stays met for the lifetime of the rule instance.
- For a missing `activation`, trailing activates immediately (existing behaviour).
- Predefined `TRAILING_STOP_TEMPLATE.parameters` UI metadata splits into `distanceValue`/`distanceUnit` and `activationValue`/`activationUnit` flat fields, mirroring the Phase A pattern.
- Side-aware computation in the harness: `sign = +1` for BUY, `−1` for SELL.

**Ask First:**
- Adding a fourth unit (`pips`, `ATR`...) — out of scope.
- Renaming `trailingNewSL` / `trailingShouldExecute` context fields — out of scope.

**Never:**
- Computing percent or price formulas in `trailingStop.ts` (template is pure).
- Touching Phase A files or templates listed there.
- Touching `maxDrawdownFromPeak.ts`, `createPeakRReachedCondition`, `createDrawdownFromPeakCondition`, `MAX_DRAWDOWN_FROM_PEAK_TEMPLATE` — these belong to Phase C.
- Introducing backward-compat aliases for the old `distance: number` / `activationR: number` shape.

## I/O & Edge-Case Matrix

Conventions: `entryPrice = E`, `currentPrice = P`, `initialSL = SL`, `riskPerUnit = E − SL`. `sign = +1` for LONG, `−1` for SHORT. All formulas live in the harness adapter.

| Scenario | Input / State | candidateSL formula (in adapter) | Notes |
|----------|---------------|---------------------------------|-------|
| Distance in R (LONG) | `distance: {0.5,'R'}`, `currentR=2`, `E=100`, `SL=99` | `E + (currentR − distance.value) × riskPerUnit` = `100 + 1.5×1 = 101.5` | Existing behaviour, preserved bit-for-bit |
| Distance in R (SHORT) | `distance: {0.5,'R'}`, `currentR=2`, `E=100`, `SL=101` | `E + (currentR − distance.value) × riskPerUnit` = `100 + 1.5×(−1) = 98.5` | Existing behaviour, preserved (riskPerUnit is signed) |
| Distance in % (LONG) | `distance: {0.5,'percent'}`, `P=100` | `P × (1 − sign × distance.value / 100)` = `100 × 0.995 = 99.5` | New |
| Distance in % (SHORT) | `distance: {0.5,'percent'}`, `P=100` | `P × (1 − sign × distance.value / 100)` = `100 × 1.005 = 100.5` | New |
| Distance in price (LONG) | `distance: {0.3,'price'}`, `P=100` | `P − sign × distance.value` = `100 − 0.3 = 99.7` | New |
| Distance in price (SHORT) | `distance: {0.3,'price'}`, `P=100` | `P − sign × distance.value` = `100 + 0.3 = 100.3` | New |
| Activation in R | `activation: {1,'R'}` | Gate: `currentR ≥ 1` (uses `PROFIT_FIELD['R']`) | Existing behaviour, preserved |
| Activation in % | `activation: {1.5,'percent'}` | Gate: `currentPctFromEntry ≥ 1.5` (uses `PROFIT_FIELD['percent']`) | New |
| Activation in price | `activation: {0.5,'price'}` | Gate: `currentPriceMove ≥ 0.5` (uses `PROFIT_FIELD['price']`) | New |
| Mixed units | `distance: {0.3,'price'}, activation: {1,'R'}` | Distance computed in price, gate via `currentR` | Independent units allowed |
| Activation omitted | `{ distance: {0.5,'R'} }` | Trail starts immediately | Existing behaviour |
| Activation stickiness (any unit) | `activation: {1,'percent'}`, percent reaches 1 then drops to 0.5 | Once activated, stays activated; trailing continues | Reuses existing `#activatedRuleIds` set |
| Favorable check (LONG, distance R) | `candidateSL > currentSL` | Move SL only when more favorable | Existing logic, unchanged |
| Favorable check (SHORT, distance R) | `candidateSL < currentSL` | Move SL only when more favorable | Existing logic, unchanged |
| Favorable check (percent, SHORT) | `candidateSL = 100.5`, `currentSL = 101` | `candidateSL < currentSL` → favorable, fires | Same favorability rule for all units |
| Invalid distance | `{ distance: { value: 0, unit: 'R' } }` | Factory throws | `Error("distance.value must be > 0")` |
| Invalid distance unit | `{ distance: { value: 0.5, unit: 'pips' } }` | Factory throws | `Error("distance.unit must be one of R | percent | price")` |
| Invalid activation | `{ ..., activation: { value: -1, unit: 'R' } }` | Factory throws | `Error("activation.value must be > 0")` |

</frozen-after-approval>

## Code Map

- `packages/rule-engine-trading/src/templates/trailingStop.ts` -- `distance: number` → `distance: Measurement`; `activationR?: number` → `activation?: Measurement`. Update `TrailingStopParams`, validate via `assertMeasurement`, keep `trailingStopParamsMap` shape (now stores the new `TrailingStopParams`). Emitted `AtomicCondition` on `trailingShouldExecute` does not change. Update the file's JSDoc to reflect multi-unit semantics.
- `packages/rule-engine-trading/src/templates/predefinedTemplates.ts` -- `TRAILING_STOP_TEMPLATE.parameters` becomes four flat fields: `distanceValue` (number, default 0.5, min 0.1, max 10), `distanceUnit` (string, default `'R'`, options `['R','percent','price']`), `activationValue` (number, default 1, min 0, max 20 — `0` means "activate immediately"), `activationUnit` (string, default `'R'`, options `['R','percent','price']`). The `create` wrapper reassembles `Measurement` and omits `activation` when `activationValue <= 0`.
- `packages/rule-engine-trading/src/public-api.ts` -- Re-exports of `createTrailingStopTemplate`, `trailingStopParamsMap`, `TrailingStopParams` stay; nothing else to change there.
- `packages/rule-engine-trading-testkit/src/harness/RuleScenarioHarness.ts` -- Inside the trailing-stop block of `#buildContext`:
  1. Replace `entryPrice + (currentR − trailingParams.distance) × riskPerUnit` with a unit dispatch on `trailingParams.distance.unit`:
     - `R`: `entryPrice + (currentR − distance.value) × riskPerUnit` (preserves existing behaviour bit-for-bit when distance is in R)
     - `percent`: `currentPrice × (1 − sign × distance.value / 100)`
     - `price`: `currentPrice − sign × distance.value`
     where `sign = this.#sideSign`.
  2. Replace activation gating: instead of hardcoded `currentR >= activationR`, look up the value of `PROFIT_FIELD[trailingParams.activation.unit]` from the context being built (use the local variables: `currentR`, `currentPctFromEntry`, `currentPriceMove`) and compare to `activation.value`. Stickiness via `#activatedRuleIds` stays unchanged.
  3. Keep the `currentR >= 0` early-return guard exactly as is (it gates trailing globally, not per-unit; profit-positive convention means it's equivalent across units).
  4. Favorable check stays unchanged: `riskPerUnit > 0 ? candidateSL > currentSL : candidateSL < currentSL`. (When `riskPerUnit` is 0 because there is no initial SL, the early-return already exits.)
- `packages/rule-engine-trading/__tests__/templates/trailingStop.test.ts` -- **NEW.** Unit tests asserting:
  - `assertMeasurement` errors for malformed `distance` / `activation`.
  - The emitted condition is still on field `trailingShouldExecute` (template stays unit-agnostic).
  - `trailingStopParamsMap` is populated with the exact `Measurement` objects.
- `packages/rule-engine-trading-testkit/__tests__/multiUnit.trailing.scenarios.test.ts` -- **NEW.** Integration scenarios covering:
  - Distance in `percent` (LONG and SHORT): SL moves match the formula `P × (1 − sign × d/100)`.
  - Distance in `price` (LONG and SHORT): SL moves match `P − sign × d`.
  - Mixed units: `distance` in price, `activation` in R.
  - Activation in `percent` and `price` — gate only fires once the threshold in that unit is reached.
  - Activation stickiness in non-R units — keeps trailing after profit dips below threshold.
  - The R-only baseline scenarios still produce identical SL trajectories to the pre-Phase-B code (regression check; one comparison case is enough).
- `packages/rule-engine-trading/README.md` -- Update the `Trailing Stop` section: rewrite the parameter table to use `Measurement`, add brief examples for `percent` and `price`, and add a one-liner that distance and activation may use independent units.

## Tasks & Acceptance

**Execution:**
- [ ] `packages/rule-engine-trading/src/templates/trailingStop.ts` -- rewrite `TrailingStopParams` to use `Measurement` for both `distance` and `activation`, validate via `assertMeasurement`, update JSDoc -- template stays pure
- [ ] `packages/rule-engine-trading/src/templates/predefinedTemplates.ts` -- split `TRAILING_STOP_TEMPLATE.parameters` into four flat fields, add reassembling `create` wrapper -- preserves UI rendering
- [ ] `packages/rule-engine-trading-testkit/src/harness/RuleScenarioHarness.ts` -- dispatch `candidateSL` on `distance.unit`, dispatch activation gating on `activation.unit` via `PROFIT_FIELD`, preserve favorability + stickiness logic -- adapter does all conversion
- [ ] `packages/rule-engine-trading/__tests__/templates/trailingStop.test.ts` -- new unit tests asserting validation errors and condition shape -- locks the contract
- [ ] `packages/rule-engine-trading-testkit/__tests__/multiUnit.trailing.scenarios.test.ts` -- new integration scenarios covering all unit combinations and stickiness -- proves the adapter pipeline
- [ ] `packages/rule-engine-trading/README.md` -- update Trailing Stop section -- public docs

**Acceptance Criteria:**
- Given any `distance.unit ∈ {R, percent, price}` and any `activation?.unit ∈ {R, percent, price}`, no source file under `packages/rule-engine-trading/src/templates/` performs `*`, `/`, `+`, or `-` against `currentPrice`, `entryPrice`, or any percent value.
- Given the existing R-only trailing-stop scenarios, all pre-Phase-B testkit tests pass with byte-identical `trailingNewSL` values.
- Given distance `{ 0.3, 'price' }` on a LONG with current price 100, then `candidateSL = 99.7`. On a SHORT with current price 100, `candidateSL = 100.3`.
- Given distance `{ 0.5, 'percent' }` on a LONG with current price 100, then `candidateSL = 99.5`. On a SHORT, `candidateSL = 100.5`.
- Given activation `{ 1.5, 'percent' }`, the first execution fires only when `currentPctFromEntry ≥ 1.5`; subsequent ticks remain active even if it drops below.
- Given mixed units (`distance` in price, `activation` in R), each side of the gating uses its own field correctly.
- Given `pnpm --filter @volatil/rule-engine-trading test && pnpm --filter @volatil/rule-engine-trading-testkit test`, all tests pass.
- Given `pnpm --filter @volatil/rule-engine-trading build && pnpm --filter @volatil/rule-engine-trading bundle`, both succeed.

## Spec Change Log

## Design Notes

**Activation gating (illustration, in adapter):**
```ts
const activationValue =
  trailingParams.activation === undefined
    ? null  // no activation → fire immediately
    : trailingParams.activation.value;
const activationField =
  trailingParams.activation === undefined
    ? null
    : PROFIT_FIELD[trailingParams.activation.unit];
const currentForActivation =
  activationField === 'currentR' ? currentR :
  activationField === 'currentPctFromEntry' ? currentPctFromEntry :
  activationField === 'currentPriceMove' ? currentPriceMove :
  Number.POSITIVE_INFINITY; // null branch — never gates
const activationMet =
  alreadyActivated ||
  activationValue === null ||
  currentForActivation >= activationValue;
```

**candidateSL dispatch (illustration, in adapter):**
```ts
let candidateSL: number;
switch (trailingParams.distance.unit) {
  case 'R':
    candidateSL = entryPrice + (currentR - trailingParams.distance.value) * riskPerUnit;
    break;
  case 'percent':
    candidateSL = currentPrice * (1 - sign * trailingParams.distance.value / 100);
    break;
  case 'price':
    candidateSL = currentPrice - sign * trailingParams.distance.value;
    break;
}
```

The favorable check (`riskPerUnit > 0 ? candidateSL > currentSL : candidateSL < currentSL`) keeps working across units because it depends on the trade direction (encoded in `riskPerUnit`'s sign), not on the distance formula. For `percent` and `price` distances, `riskPerUnit` is still computed from `entryPrice − initialSL`, so its sign correctly reflects LONG/SHORT.

## Verification

**Commands:**
- `pnpm --filter @volatil/rule-engine-trading build` -- expected: tsc exits 0
- `pnpm --filter @volatil/rule-engine-trading bundle` -- expected: tsup exits 0
- `pnpm --filter @volatil/rule-engine-trading test` -- expected: all unit tests pass, including new trailingStop tests
- `pnpm --filter @volatil/rule-engine-trading-testkit test` -- expected: all integration scenarios pass; new multiUnit.trailing.scenarios pass; existing trailing-stop scenarios still green
- `grep -nE '(currentPrice|entryPrice).*[+\-*/]' packages/rule-engine-trading/src/templates/ packages/rule-engine-trading/src/conditions/` -- expected: no match
