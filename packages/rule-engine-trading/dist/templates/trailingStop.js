/**
 * @file trailingStop.ts
 * @description Template factory for trailing stop rules.
 *
 * The trailing stop moves the stop loss dynamically as price advances,
 * placing the SL at a configurable `distance` from the current price/profit.
 *
 * Both `distance` (the geometric step the SL trails the price by) and the
 * optional `activation` threshold (profit-from-entry that must be reached
 * before trailing arms) are `Measurement` values. They may use independent
 * units (`R`, `percent`, or `price`) because they describe orthogonal things:
 * `distance` is a geometric offset, `activation` is a profit-from-entry gate.
 *
 * The template stays pure — it emits a single `AtomicCondition` on
 * `trailingShouldExecute` and a `MOVE_STOP_LOSS` action that reads the
 * pre-computed `trailingNewSL`. All unit-aware arithmetic lives in the
 * adapter (the testkit harness or the production context builder).
 *
 * The template uses `isRecurring = true` so the rule stays ACTIVE after
 * each successful execution and can continue trailing on subsequent ticks.
 */
import { RuleTemplate, AtomicCondition, Operator } from 'rule-engine-monorepo/rule-engine';
import { assertMeasurement } from '../domain/Measurement.js';
import { createMoveStopLossAction } from '../actions/moveStopLoss.js';
/**
 * WeakMap that stores the TrailingStopParams for each created RuleTemplate.
 * This allows the testkit harness (or production context builder) to retrieve
 * the original params without extending the upstream RuleTemplate type.
 *
 * @internal Not exported from public-api — internal convention between the
 * trailingStop factory and the harness context builder.
 */
export const trailingStopParamsMap = new WeakMap();
/**
 * Creates a rule template for a trailing stop loss.
 *
 * The rule:
 * - Evaluates `trailingShouldExecute === 1` (populated by context builder)
 * - Executes MOVE_STOP_LOSS with `newStopPrice = { var: 'trailingNewSL' }`
 * - Stays ACTIVE after each fire (isRecurring = true)
 *
 * Context requirements (populated by harness or production service):
 * - `trailingShouldExecute`: 0 | 1 — 1 when activation is met AND new SL is favorable
 * - `trailingNewSL`: number — the new SL price to move to
 *
 * Throws synchronously when:
 * - `distance` is not a well-formed positive `Measurement`.
 * - `activation` is provided and not a well-formed positive `Measurement`.
 *
 * @example
 * ```ts
 * // Trailing 0.5R, no activation
 * const template = createTrailingStopTemplate({
 *   distance: { value: 0.5, unit: 'R' },
 * });
 *
 * // Trailing 0.5%, only activates at +1% profit
 * const template = createTrailingStopTemplate({
 *   distance: { value: 0.5, unit: 'percent' },
 *   activation: { value: 1, unit: 'percent' },
 * });
 *
 * // Mixed units: trail by 0.3 in price, arm once profit reaches 1R
 * const template = createTrailingStopTemplate({
 *   distance: { value: 0.3, unit: 'price' },
 *   activation: { value: 1, unit: 'R' },
 * });
 * ```
 */
export function createTrailingStopTemplate(params) {
    const { distance, activation } = params;
    assertMeasurement('distance', distance);
    if (activation !== undefined) {
        assertMeasurement('activation', activation);
    }
    // Condition: trailingShouldExecute === 1
    // The context builder is responsible for computing this value.
    const condition = AtomicCondition.create('trailingShouldExecute', Operator.EQUAL, 1, 'trailing_should_execute');
    // Action: move stop loss to the pre-computed trailingNewSL value
    const action = createMoveStopLossAction({
        newStopPrice: { var: 'trailingNewSL' },
    });
    // isRecurring = true: rule stays ACTIVE after each successful execution
    const template = RuleTemplate.create(condition, [action], [], true);
    // Store params in WeakMap for harness context builder retrieval
    const stored = { distance };
    if (activation !== undefined)
        stored.activation = activation;
    trailingStopParamsMap.set(template, stored);
    return template;
}
//# sourceMappingURL=trailingStop.js.map